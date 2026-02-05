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
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image data is required' }),
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
            content: `You are an invoice data extraction expert. Extract structured data from invoice images and return ONLY a valid JSON object with no markdown formatting, no code blocks, no explanations. The JSON must have this exact structure:
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
- Product unit should be one of: pcs, kg, m, box, set, carton, roll
- Extract HS codes if visible (usually 6-10 digit codes)
- Date format must be YYYY-MM-DD
- Supplier country should be the full country name if identifiable`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all invoice data from this image and return the JSON object.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
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

    console.log('AI Response:', extractedText);

    // Parse the JSON response
    let extractedData;
    try {
      // Remove markdown code blocks if present
      const cleanText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Raw text:', extractedText);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response. Please try again or enter data manually.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the structure
    if (!extractedData.supplier || !extractedData.invoice || !extractedData.products) {
      return new Response(
        JSON.stringify({ error: 'Invalid data structure extracted. Please review and correct manually.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
