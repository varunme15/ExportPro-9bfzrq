import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, subscription_status, admin_key } = await req.json();

    // Validate required fields
    if (!user_id || !subscription_status) {
      return new Response(
        JSON.stringify({ error: 'user_id and subscription_status are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate subscription_status value
    const validStatuses = ['FREE', 'PAID', 'TRIAL', 'CANCELED'];
    if (!validStatuses.includes(subscription_status)) {
      return new Response(
        JSON.stringify({ error: `Invalid subscription_status. Must be one of: ${validStatuses.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authentication: require service role key via Authorization header OR admin_key in body
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Check if caller is authorized:
    // 1. Service role key in Authorization header (from webhook or server-side call)
    // 2. admin_key in body matches the service role key (from admin panel)
    const bearerToken = authHeader?.replace('Bearer ', '') ?? '';
    const isAuthorized = bearerToken === serviceRoleKey || admin_key === serviceRoleKey;

    if (!isAuthorized) {
      console.error('Unauthorized attempt to update subscription');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Service role key required.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user exists
    const { data: existingUser, error: lookupError } = await supabaseAdmin
      .from('user_settings')
      .select('user_id, subscription_status')
      .eq('user_id', user_id)
      .single();

    if (lookupError || !existingUser) {
      console.error('User lookup failed:', lookupError?.message);
      return new Response(
        JSON.stringify({ error: `User not found: ${user_id}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const previousStatus = existingUser.subscription_status;

    // Update subscription status
    const { data, error: updateError } = await supabaseAdmin
      .from('user_settings')
      .update({
        subscription_status,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id)
      .select('user_id, subscription_status, updated_at')
      .single();

    if (updateError) {
      console.error('Update failed:', updateError.message);
      return new Response(
        JSON.stringify({ error: `Failed to update subscription: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Subscription updated: user=${user_id}, ${previousStatus} -> ${subscription_status}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user_id: data.user_id,
          previous_status: previousStatus,
          new_status: data.subscription_status,
          updated_at: data.updated_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('update-subscription error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
