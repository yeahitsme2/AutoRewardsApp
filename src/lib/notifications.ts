import { supabase } from './supabase';
import type { Database } from '../types/database';

type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

type NotifyPayload = {
  shopId?: string | null;
  recipientRole: 'admin' | 'customer';
  recipientId?: string | null;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  push?: boolean;
};

const safeInsertNotification = async (payload: NotificationInsert) => {
  const { error } = await supabase.from('notifications').insert(payload);
  if (error) {
    console.error('Failed to insert notification:', error);
  }
};

const safeSendPush = async (payload: {
  target: 'admin' | 'customer';
  shop_id?: string | null;
  customer_id?: string | null;
  title: string;
  message: string;
  url?: string;
}) => {
  try {
    await supabase.functions.invoke('send-push', { body: payload });
  } catch (error) {
    console.error('Failed to send push notification:', error);
  }
};

export const notify = async ({
  shopId,
  recipientRole,
  recipientId,
  title,
  body,
  entityType,
  entityId,
  actionUrl,
  metadata,
  push = true,
}: NotifyPayload) => {
  const payload: NotificationInsert = {
    shop_id: shopId || null,
    recipient_role: recipientRole,
    recipient_id: recipientId || null,
    title,
    body,
    entity_type: entityType || null,
    entity_id: entityId || null,
    action_url: actionUrl || null,
    metadata: metadata || null,
  };

  await safeInsertNotification(payload);

  if (!push) return;
  if (recipientRole === 'admin') {
    if (!shopId) return;
    await safeSendPush({
      target: 'admin',
      shop_id: shopId,
      title,
      message: body,
      url: actionUrl || '/',
    });
  } else if (recipientRole === 'customer') {
    if (!recipientId) return;
    await safeSendPush({
      target: 'customer',
      customer_id: recipientId,
      title,
      message: body,
      url: actionUrl || '/',
    });
  }
};

export const notifyAdmins = async ({
  shopId,
  title,
  body,
  entityType,
  entityId,
  actionUrl,
  metadata,
  push = true,
}: Omit<NotifyPayload, 'recipientRole' | 'recipientId'> & { shopId: string }) => (
  notify({
    shopId,
    recipientRole: 'admin',
    recipientId: null,
    title,
    body,
    entityType,
    entityId,
    actionUrl,
    metadata,
    push,
  })
);

export const notifyCustomer = async ({
  shopId,
  customerId,
  title,
  body,
  entityType,
  entityId,
  actionUrl,
  metadata,
  push = true,
}: {
  shopId?: string | null;
  customerId: string;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  push?: boolean;
}) => (
  notify({
    shopId,
    recipientRole: 'customer',
    recipientId: customerId,
    title,
    body,
    entityType,
    entityId,
    actionUrl,
    metadata,
    push,
  })
);
