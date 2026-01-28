import { serve } from 'https://deno.land/std@0.201.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendNotification } from 'jsr:@negrel/webpush@0.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { target, shop_id, customer_id, title, message, url } = body || {};

    if (!target || !title) {
      return new Response(JSON.stringify({ error: 'Missing target or title' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let subscriptions: any[] = [];
    if (target === 'customer') {
      if (!customer_id) {
        return new Response(JSON.stringify({ error: 'Missing customer_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: customerRow, error: customerError } = await supabase
        .from('customers')
        .select('auth_user_id')
        .eq('id', customer_id)
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customerRow?.auth_user_id) {
        return new Response(JSON.stringify({ error: 'Customer has no auth_user_id' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('auth_user_id', customerRow.auth_user_id)
        .eq('user_role', 'customer');
      if (error) throw error;
      subscriptions = data || [];
    } else if (target === 'admin') {
      if (!shop_id) {
        return new Response(JSON.stringify({ error: 'Missing shop_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('shop_id', shop_id)
        .eq('user_role', 'admin');
      if (error) throw error;
      subscriptions = data || [];
    } else {
      return new Response(JSON.stringify({ error: 'Invalid target' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')!;

    const payload = JSON.stringify({
      title,
      body: message || '',
      url: url || '/',
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };
      try {
        await sendNotification(subscription, payload, {
          vapidDetails: {
            subject: vapidSubject,
            publicKey: vapidPublicKey,
            privateKey: vapidPrivateKey,
          },
        });
        sent += 1;
      } catch (_err) {
        failed += 1;
      }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
