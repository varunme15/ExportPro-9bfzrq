import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, pdfBase64, fileType } = await req.json();

    const fileData = imageBase64 || pdfBase64;
    const type = fileType || (pdfBase64 ? 'pdf' : 'image');

    if (!fileData) {
      return new Response(
        JSON.stringify({ error: 'Image or PDF data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OnSpace AI credentials
    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      return new Response(
        JSON.stringify({ error: 'OnSpace AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean base64 data (remove data URL prefix if present)
    let cleanBase64 = fileData;
    if (fileData.includes(',')) {
      cleanBase64 = fileData.split(',')[1];
    }

    // Determine mime type
    const mimeType = type === 'pdf' ? 'application/pdf' : 'image/jpeg';

    console.log(`Processing ${type} file, mime type: ${mimeType}, base64 length: ${cleanBase64.length}`);

    // PDF files are not well supported via image_url - inform user
    if (type === 'pdf') {
      console.log('PDF file detected - attempting to process but may have limited support');
    }

    // Build the message content
    // Note: PDF support via base64 is limited in most vision models
    const messageContent = [
      {
        type: 'text',
        text: type === 'pdf' 
          ? 'Extract all invoice data from this PDF document and return the JSON object. Make sure to extract supplier information, invoice details (number, date, amount), and all product line items with their names, quantities, units, rates/prices, and HS codes if visible.'
          : 'Extract all invoice data from this image and return the JSON object.'
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${cleanBase64}`
        }
      }
    ];

    // Call OnSpace AI for OCR
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are an invoice data extraction expert. Extract structured data from invoice documents (images or PDFs) and return ONLY a valid JSON object with no markdown formatting, no code blocks, no explanations. The JSON must have this exact structure:
{
  "supplier": {
    "name": "string",
    "contactPerson": "string or empty",
    "email": "string or empty",
    "phone": "string or empty",
    "address": "string or empty",
    "country": "string or empty"
  },
  "invoice": {
    "invoiceNumber": "string",
    "date": "YYYY-MM-DD",
    "totalAmount": number
  },
  "products": [
    {
      "name": "string",
      "quantity": number,
      "unit": "string (pcs/kg/m/box/set)",
      "rate": number,
      "hsCode": "string (6-10 digits) or empty"
    }
  ]
}

Rules:
- Return ONLY the JSON object, no other text
- If a field cannot be determined, use empty string "" for strings or 0 for numbers
- Ensure all numbers are valid (not NaN or null)
- Product unit should be one of: pcs, kg, m, box, set, carton, roll, ltr, gm
- Extract HS codes if visible (usually 6-10 digit codes)
- Date format must be YYYY-MM-DD
- Supplier country should be the full country name if identifiable
- For PDFs with multiple pages, extract data from all pages
- Combine products from all pages into a single products array
- Look carefully for all line items in tables`
          },
          {
            role: 'user',
            content: messageContent
          }
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OnSpace AI error:', errorText);
      return new Response(
        JSON.stringify({ error: `AI processing failed: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content ?? '';

    console.log('AI Response received, length:', extractedText.length);
    console.log('AI Response preview:', extractedText.substring(0, 500));

    // Check if AI returned an error or couldn't process the file
    if (!extractedText || extractedText.trim() === '') {
      console.error('Empty response from AI');
      const errorMsg = type === 'pdf' 
        ? 'Could not extract data from PDF. PDF parsing has limited support. Please try uploading an image (photo or screenshot) of the invoice instead.'
        : 'Could not extract data from image. Please try with a clearer image.';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for common AI refusal patterns
    const refusalPatterns = [
      'cannot process',
      'unable to',
      'not able to',
      'cannot read',
      'cannot extract',
      'cannot access',
      'sorry',
      'i apologize',
      'not supported',
      'cannot view',
      'cannot see'
    ];
    
    const lowerText = extractedText.toLowerCase();
    const hasRefusal = refusalPatterns.some(pattern => lowerText.includes(pattern));
    
    if (hasRefusal && !lowerText.includes('{')) {
      console.error('AI refused to process:', extractedText.substring(0, 200));
      const errorMsg = type === 'pdf'
        ? 'Unable to parse PDF document. PDF files have limited support with AI vision. Please convert your PDF to an image (screenshot or photo) and try again.'
        : 'Unable to extract data from this image. Please try with a clearer, higher resolution image.';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response
    let extractedData;
    try {
      // Remove markdown code blocks if present
      let cleanText = extractedText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // Try to find JSON object in the response
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      } else {
        // No JSON found in response
        console.error('No JSON found in response:', extractedText.substring(0, 300));
        const errorMsg = type === 'pdf'
          ? 'Could not parse PDF invoice. PDF parsing is limited. Please try taking a photo or screenshot of the invoice instead.'
          : 'Could not extract structured data from this image. Please try with a clearer image or enter data manually.';
        throw new Error(errorMsg);
      }
      
      extractedData = JSON.parse(cleanText);
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError, 'Raw text:', extractedText.substring(0, 500));
      const errorMsg = parseError.message && parseError.message.includes('PDF')
        ? parseError.message
        : type === 'pdf'
          ? 'Failed to parse PDF invoice data. PDF support is limited. Please try uploading an image (photo/screenshot) of the invoice instead.'
          : 'Failed to parse extracted data. Please try again with a clearer image or enter data manually.';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the structure
    if (!extractedData.supplier || !extractedData.invoice || !extractedData.products) {
      console.error('Invalid structure:', extractedData);
      return new Response(
        JSON.stringify({ error: 'Invalid data structure extracted. Please review and correct manually.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure products is an array
    if (!Array.isArray(extractedData.products)) {
      extractedData.products = [];
    }

    // Clean up the data
    extractedData.products = extractedData.products.map((p: any) => ({
      name: String(p.name || '').trim(),
      quantity: Number(p.quantity) || 0,
      unit: String(p.unit || 'pcs').toLowerCase(),
      rate: Number(p.rate) || 0,
      hsCode: String(p.hsCode || '').trim(),
    }));

    extractedData.invoice.totalAmount = Number(extractedData.invoice.totalAmount) || 0;

    console.log('Successfully extracted data with', extractedData.products.length, 'products');

    return new Response(
      JSON.stringify({ data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Invoice OCR error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'OCR processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
