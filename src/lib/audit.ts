import { supabase } from './supabase';

type AuditPayload = {
  shopId: string;
  actorRole?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logAuditEvent(payload: AuditPayload) {
  if (!payload.shopId) return;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const actorAuthUserId = auth.user?.id || null;
    await supabase.from('audit_events').insert({
      shop_id: payload.shopId,
      actor_auth_user_id: actorAuthUserId,
      actor_role: payload.actorRole || null,
      event_type: payload.eventType,
      entity_type: payload.entityType,
      entity_id: payload.entityId || null,
      metadata: payload.metadata || null,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}
