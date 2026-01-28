import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => {
  const reservationInsertMock = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: { id: 'res-1' }, error: null }),
    })),
  }));
  const reservationUpdateMock = vi.fn(() => ({
    eq: vi.fn(() => ({ eq: vi.fn(() => ({ data: null, error: null })) })),
  }));
  const inventoryInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  (globalThis as any).__inventorySupabaseMocks = {
    reservationInsertMock,
    reservationUpdateMock,
    inventoryInsertMock,
  };
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'repair_order_part_reservations') {
          return {
            insert: reservationInsertMock,
            update: reservationUpdateMock,
          };
        }
        if (table === 'inventory_transactions') {
          return { insert: inventoryInsertMock };
        }
        return { insert: inventoryInsertMock };
      },
    },
  };
});

vi.mock('../audit', () => {
  const auditMock = vi.fn().mockResolvedValue(undefined);
  (globalThis as any).__inventoryAuditMock = auditMock;
  return { logAuditEvent: auditMock };
});

import { consumeReservedParts, reservePart } from '../inventory';

const getInventorySupabaseMocks = () => (globalThis as any).__inventorySupabaseMocks;
const getInventoryAuditMock = () => (globalThis as any).__inventoryAuditMock;

describe('inventory helpers', () => {
  beforeEach(() => {
    const mocks = getInventorySupabaseMocks();
    const auditMock = getInventoryAuditMock();
    mocks.reservationInsertMock.mockClear();
    mocks.reservationUpdateMock.mockClear();
    mocks.inventoryInsertMock.mockClear();
    auditMock?.mockClear();
  });

  it('reserves parts and logs inventory', async () => {
    await reservePart({
      shopId: 'shop-1',
      orderId: 'ro-1',
      partId: 'part-1',
      locationId: 'loc-1',
      quantity: 2,
    });
    const mocks = getInventorySupabaseMocks();
    const auditMock = getInventoryAuditMock();
    expect(mocks.reservationInsertMock).toHaveBeenCalled();
    expect(mocks.inventoryInsertMock).toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalled();
  });

  it('consumes reserved parts and logs inventory', async () => {
    await consumeReservedParts({
      shopId: 'shop-1',
      orderId: 'ro-1',
      reservations: [
        {
          id: 'res-1',
          repair_order_id: 'ro-1',
          part_id: 'part-1',
          location_id: 'loc-1',
          quantity: 1,
          status: 'reserved',
          repair_order_item_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any,
      ],
    });
    const mocks = getInventorySupabaseMocks();
    const auditMock = getInventoryAuditMock();
    expect(mocks.inventoryInsertMock).toHaveBeenCalled();
    expect(mocks.reservationUpdateMock).toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalled();
  });
});
