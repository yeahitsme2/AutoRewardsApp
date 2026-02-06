import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const selectMock = vi.fn(() => ({
  eq: vi.fn(() => ({
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'outbound_message_log') {
        return { insert: insertMock };
      }
      if (table === 'sms_opt_out') {
        return {
          upsert: upsertMock,
          select: selectMock,
        };
      }
      return { insert: insertMock };
    },
  },
}));

import { logOutboundMessage, setSmsOptStatus } from '../messaging';

describe('messaging helpers', () => {
  beforeEach(() => {
    insertMock.mockClear();
    upsertMock.mockClear();
  });

  it('logs outbound messages', async () => {
    await logOutboundMessage({
      shopId: 'shop-1',
      customerId: 'cust-1',
      channel: 'email',
      subject: 'Test',
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shop_id: 'shop-1',
        customer_id: 'cust-1',
        channel: 'email',
      })
    );
  });

  it('upserts sms opt-out status', async () => {
    await setSmsOptStatus('shop-1', 'cust-1', 'opted_out');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shop_id: 'shop-1',
        customer_id: 'cust-1',
        status: 'opted_out',
      })
    );
  });
});
