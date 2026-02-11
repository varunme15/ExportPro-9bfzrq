import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: jsonHeaders }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Create admin client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract caller info for audit logging
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // --- AUTH: Two modes ---
    // Mode 1: Service role key (webhooks, server-to-server)
    // Mode 2: Authenticated admin user (admin panel via JWT)
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const bearerToken = authHeader?.replace('Bearer ', '') ?? '';

    const isServiceRole = bearerToken === serviceRoleKey || body.admin_key === serviceRoleKey;
    let adminUserId: string | null = null;

    if (!isServiceRole) {
      // Try JWT-based admin auth
      if (!bearerToken) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Authentication required.' }),
          { status: 401, headers: jsonHeaders }
        );
      }

      // Verify JWT and get user
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(bearerToken);
      if (userError || !user) {
        console.error('JWT verification failed:', userError?.message);
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Invalid token.' }),
          { status: 401, headers: jsonHeaders }
        );
      }

      // Check admin role
      const { data: adminRole, error: roleError } = await supabaseAdmin
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleError || !adminRole) {
        console.error(`Non-admin access attempt by user ${user.id}`);
        return new Response(
          JSON.stringify({ error: 'Forbidden. Admin access required.' }),
          { status: 403, headers: jsonHeaders }
        );
      }

      adminUserId = user.id;
    }

    // --- ROUTE: action-based dispatch ---
    switch (action || 'update_subscription') {
      case 'update_subscription':
        return await handleUpdateSubscription(body, supabaseAdmin, adminUserId, ipAddress, userAgent, jsonHeaders);

      case 'search_users':
        return await handleSearchUsers(body, supabaseAdmin, jsonHeaders);

      case 'get_user_details':
        return await handleGetUserDetails(body, supabaseAdmin, jsonHeaders);

      case 'get_audit_log':
        return await handleGetAuditLog(body, supabaseAdmin, jsonHeaders);

      case 'get_admin_stats':
        return await handleGetAdminStats(supabaseAdmin, jsonHeaders);

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: jsonHeaders }
        );
    }
  } catch (error) {
    console.error('update-subscription error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// --- Handler: Update Subscription ---
async function handleUpdateSubscription(
  body: any,
  supabaseAdmin: any,
  adminUserId: string | null,
  ipAddress: string,
  userAgent: string,
  headers: Record<string, string>
) {
  const { user_id, subscription_status } = body;

  if (!user_id || !subscription_status) {
    return new Response(
      JSON.stringify({ error: 'user_id and subscription_status are required' }),
      { status: 400, headers }
    );
  }

  const validStatuses = ['FREE', 'PAID', 'TRIAL', 'CANCELED'];
  if (!validStatuses.includes(subscription_status)) {
    return new Response(
      JSON.stringify({ error: `Invalid subscription_status. Must be one of: ${validStatuses.join(', ')}` }),
      { status: 400, headers }
    );
  }

  // Verify target user exists
  const { data: existingUser, error: lookupError } = await supabaseAdmin
    .from('user_settings')
    .select('user_id, subscription_status, name, email')
    .eq('user_id', user_id)
    .single();

  if (lookupError || !existingUser) {
    console.error('User lookup failed:', lookupError?.message);
    return new Response(
      JSON.stringify({ error: `User not found: ${user_id}` }),
      { status: 404, headers }
    );
  }

  const previousStatus = existingUser.subscription_status;

  // Skip if no change
  if (previousStatus === subscription_status) {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user_id,
          previous_status: previousStatus,
          new_status: subscription_status,
          message: 'No change - status already set',
        },
      }),
      { status: 200, headers }
    );
  }

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
      { status: 500, headers }
    );
  }

  // Write audit log
  const { error: auditError } = await supabaseAdmin
    .from('admin_audit_log')
    .insert([{
      admin_user_id: adminUserId || user_id,
      target_user_id: user_id,
      action_type: 'SUBSCRIPTION_CHANGE',
      old_value: previousStatus,
      new_value: subscription_status,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        target_email: existingUser.email || '',
        target_name: existingUser.name || '',
        source: adminUserId ? 'admin_panel' : 'service_role',
      },
    }]);

  if (auditError) {
    console.error('Audit log write failed:', auditError.message);
    // Don't fail the request, just log the error
  }

  console.log(`Subscription updated: user=${user_id}, ${previousStatus} -> ${subscription_status}, by=${adminUserId || 'service_role'}`);

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
    { status: 200, headers }
  );
}

// --- Handler: Search Users ---
async function handleSearchUsers(
  body: any,
  supabaseAdmin: any,
  headers: Record<string, string>
) {
  const { query, page = 1, per_page = 20 } = body;

  if (!query || query.trim().length < 2) {
    return new Response(
      JSON.stringify({ error: 'Search query must be at least 2 characters' }),
      { status: 400, headers }
    );
  }

  const offset = (page - 1) * per_page;
  const searchTerm = `%${query.trim()}%`;

  // Search in user_settings (has name + email) joined with subscription info
  const { data, error, count } = await supabaseAdmin
    .from('user_settings')
    .select('user_id, name, email, subscription_status, currency, created_at, updated_at', { count: 'exact' })
    .or(`email.ilike.${searchTerm},name.ilike.${searchTerm}`)
    .order('created_at', { ascending: false })
    .range(offset, offset + per_page - 1);

  if (error) {
    console.error('Search error:', error.message);
    return new Response(
      JSON.stringify({ error: `Search failed: ${error.message}` }),
      { status: 500, headers }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: data || [],
      pagination: {
        page,
        per_page,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / per_page),
      },
    }),
    { status: 200, headers }
  );
}

// --- Handler: Get User Details ---
async function handleGetUserDetails(
  body: any,
  supabaseAdmin: any,
  headers: Record<string, string>
) {
  const { user_id } = body;

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      { status: 400, headers }
    );
  }

  // Get user settings
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (settingsError || !settings) {
    return new Response(
      JSON.stringify({ error: `User not found: ${user_id}` }),
      { status: 404, headers }
    );
  }

  // Get usage counts
  const [suppliers, invoices, products, shipments] = await Promise.all([
    supabaseAdmin.from('suppliers').select('id', { count: 'exact', head: true }).eq('user_id', user_id),
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', user_id),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('user_id', user_id),
    supabaseAdmin.from('shipments').select('id', { count: 'exact', head: true }).eq('user_id', user_id),
  ]);

  // Get monthly counts
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const [monthlyInvoices, monthlyShipments] = await Promise.all([
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true })
      .eq('user_id', user_id).gte('created_at', startOfMonth).lte('created_at', endOfMonth),
    supabaseAdmin.from('shipments').select('id', { count: 'exact', head: true })
      .eq('user_id', user_id).gte('created_at', startOfMonth).lte('created_at', endOfMonth),
  ]);

  // Get recent audit log for this user
  const { data: auditLog } = await supabaseAdmin
    .from('admin_audit_log')
    .select('*')
    .eq('target_user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(10);

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        user_id: settings.user_id,
        name: settings.name,
        email: settings.email,
        subscription_status: settings.subscription_status,
        currency: settings.currency,
        country: settings.country,
        created_at: settings.created_at,
        updated_at: settings.updated_at,
        usage: {
          total_suppliers: suppliers.count || 0,
          total_invoices: invoices.count || 0,
          total_products: products.count || 0,
          total_shipments: shipments.count || 0,
          monthly_invoices: monthlyInvoices.count || 0,
          monthly_shipments: monthlyShipments.count || 0,
        },
        recent_audit_log: auditLog || [],
      },
    }),
    { status: 200, headers }
  );
}

// --- Handler: Get Audit Log ---
async function handleGetAuditLog(
  body: any,
  supabaseAdmin: any,
  headers: Record<string, string>
) {
  const { target_user_id, page = 1, per_page = 50, date_from, date_to } = body;

  const offset = (page - 1) * per_page;

  let query = supabaseAdmin
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + per_page - 1);

  if (target_user_id) {
    query = query.eq('target_user_id', target_user_id);
  }
  if (date_from) {
    query = query.gte('created_at', date_from);
  }
  if (date_to) {
    query = query.lte('created_at', date_to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Audit log query error:', error.message);
    return new Response(
      JSON.stringify({ error: `Failed to fetch audit log: ${error.message}` }),
      { status: 500, headers }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: data || [],
      pagination: {
        page,
        per_page,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / per_page),
      },
    }),
    { status: 200, headers }
  );
}

// --- Handler: Get Admin Stats ---
async function handleGetAdminStats(
  supabaseAdmin: any,
  headers: Record<string, string>
) {
  // Get overall counts
  const [totalUsers, freeUsers, paidUsers, trialUsers] = await Promise.all([
    supabaseAdmin.from('user_settings').select('user_id', { count: 'exact', head: true }),
    supabaseAdmin.from('user_settings').select('user_id', { count: 'exact', head: true }).eq('subscription_status', 'FREE'),
    supabaseAdmin.from('user_settings').select('user_id', { count: 'exact', head: true }).eq('subscription_status', 'PAID'),
    supabaseAdmin.from('user_settings').select('user_id', { count: 'exact', head: true }).eq('subscription_status', 'TRIAL'),
  ]);

  // Monthly new signups
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count: newUsersThisMonth } = await supabaseAdmin
    .from('user_settings')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', startOfMonth);

  // Recent subscription changes
  const { data: recentChanges } = await supabaseAdmin
    .from('admin_audit_log')
    .select('*')
    .eq('action_type', 'SUBSCRIPTION_CHANGE')
    .order('created_at', { ascending: false })
    .limit(5);

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        total_users: totalUsers.count || 0,
        free_users: freeUsers.count || 0,
        paid_users: paidUsers.count || 0,
        trial_users: trialUsers.count || 0,
        new_users_this_month: newUsersThisMonth || 0,
        recent_subscription_changes: recentChanges || [],
      },
    }),
    { status: 200, headers }
  );
}
