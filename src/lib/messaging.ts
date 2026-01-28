import { supabase } from './supabase';

type OutboundLogPayload = {
  shopId: string;
  customerId?: string | null;
  channel: 'app' | 'email' | 'sms';
  subject?: string | null;
  body?: string | null;
  status?: string;
  segments?: number | null;
  providerMessageId?: string | null;
};

export async function logOutboundMessage(payload: OutboundLogPayload) {
  if (!payload.shopId) return;
  try {
    await supabase.from('outbound_message_log').insert({
      shop_id: payload.shopId,
      customer_id: payload.customerId || null,
      channel: payload.channel,
      subject: payload.subject || null,
      body: payload.body || null,
      status: payload.status || 'queued',
      segments: payload.segments ?? 1,
      provider_message_id: payload.providerMessageId || null,
    });
  } catch (error) {
    console.error('Failed to log outbound message:', error);
  }
}

export async function getSmsOptStatus(shopId: string, customerId: string) {
  const { data, error } = await supabase
    .from('sms_opt_out')
    .select('*')
    .eq('shop_id', shopId)
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) {
    console.error('Failed to load sms opt-out status:', error);
    return 'opted_in';
  }
  return (data?.status as 'opted_in' | 'opted_out') || 'opted_in';
}

export async function setSmsOptStatus(shopId: string, customerId: string, status: 'opted_in' | 'opted_out') {
  const { error } = await supabase
    .from('sms_opt_out')
    .upsert({
      shop_id: shopId,
      customer_id: customerId,
      status,
      updated_at: new Date().toISOString(),
    });
  if (error) {
    console.error('Failed to update sms opt-out status:', error);
  }
}
