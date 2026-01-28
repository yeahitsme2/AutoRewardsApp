import { supabase } from './supabase';
import { logAuditEvent } from './audit';
import type { RepairOrderPartReservation } from '../types/database';

type ReservePartPayload = {
  shopId: string;
  orderId: string;
  partId: string;
  locationId: string;
  quantity: number;
};

export async function reservePart(payload: ReservePartPayload) {
  const { data, error } = await supabase
    .from('repair_order_part_reservations')
    .insert({
      repair_order_id: payload.orderId,
      part_id: payload.partId,
      location_id: payload.locationId,
      quantity: payload.quantity,
      status: 'reserved',
    })
    .select('*')
    .single();
  if (error) throw error;

  await supabase.from('inventory_transactions').insert({
    shop_id: payload.shopId,
    location_id: payload.locationId,
    part_id: payload.partId,
    transaction_type: 'reserve',
    quantity: payload.quantity,
    reference_type: 'ro',
    reference_id: payload.orderId,
  });

  await logAuditEvent({
    shopId: payload.shopId,
    actorRole: 'admin',
    eventType: 'inventory_reserved',
    entityType: 'repair_order',
    entityId: payload.orderId,
    metadata: { part_id: payload.partId, quantity: payload.quantity },
  });

  return data as RepairOrderPartReservation;
}

type ConsumeReservedPayload = {
  shopId: string;
  orderId: string;
  reservations: RepairOrderPartReservation[];
};

export async function consumeReservedParts(payload: ConsumeReservedPayload) {
  const reserved = payload.reservations.filter(
    (res) => res.repair_order_id === payload.orderId && res.status === 'reserved'
  );
  if (reserved.length === 0) return 0;

  const transactions = reserved.map((res) => ({
    shop_id: payload.shopId,
    location_id: res.location_id,
    part_id: res.part_id,
    transaction_type: 'consume' as const,
    quantity: res.quantity,
    reference_type: 'ro' as const,
    reference_id: payload.orderId,
  }));

  const { error } = await supabase.from('inventory_transactions').insert(transactions);
  if (error) throw error;

  await supabase
    .from('repair_order_part_reservations')
    .update({ status: 'consumed', updated_at: new Date().toISOString() })
    .eq('repair_order_id', payload.orderId)
    .eq('status', 'reserved');

  await logAuditEvent({
    shopId: payload.shopId,
    actorRole: 'admin',
    eventType: 'inventory_consumed',
    entityType: 'repair_order',
    entityId: payload.orderId,
    metadata: { reserved_count: reserved.length },
  });

  return reserved.length;
}
