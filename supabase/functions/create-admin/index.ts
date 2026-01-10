import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateAdminRequest {
  email: string;
  password: string;
  full_name: string;
  shop_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: superAdmin, error: superAdminError } = await supabaseAdmin
      .from('super_admins')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (superAdminError || !superAdmin) {
      throw new Error('Only super admins can create admin accounts');
    }

    const { email, password, full_name, shop_id }: CreateAdminRequest = await req.json();

    if (!email || !password || !full_name || !shop_id) {
      throw new Error('Missing required fields');
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        shop_id,
        is_admin: true,
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    let retries = 0;
    const maxRetries = 10;
    let customerRecord = null;

    while (retries < maxRetries) {
      const { data: customer, error: customerError } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .maybeSingle();

      if (customer) {
        customerRecord = customer;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    }

    if (!customerRecord) {
      throw new Error('Customer record was not created. Please try logging in.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: authData.user,
        customer: customerRecord,
        message: `Admin account created for ${email}`,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    const error = err as Error;
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});