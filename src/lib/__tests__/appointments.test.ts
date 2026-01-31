import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => {
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: { sms_enabled: true }, error: null });
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'shop_settings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
          })),
        };
      }
      if (table === 'appointment_reminders') {
        return { insert: insertMock };
      }
      return { insert: insertMock };
    }),
  };
  (globalThis as any).__appointmentsSupabaseMocks = { insertMock, maybeSingleMock };
  return { supabase };
});

vi.mock('../messaging', () => {
  const getSmsOptStatusMock = vi.fn().mockResolvedValue('opted_in');
  const logOutboundMessageMock = vi.fn().mockResolvedValue(undefined);
  (globalThis as any).__appointmentMessagingMocks = { getSmsOptStatusMock, logOutboundMessageMock };
  return {
    getSmsOptStatus: getSmsOptStatusMock,
    logOutboundMessage: logOutboundMessageMock,
  };
});

import { scheduleAppointmentReminders } from '../appointments';

const getSupabaseMocks = () => (globalThis as any).__appointmentsSupabaseMocks;
const getMessagingMocks = () => (globalThis as any).__appointmentMessagingMocks;

describe('scheduleAppointmentReminders', () => {
  beforeEach(() => {
    const supabaseMocks = getSupabaseMocks();
    const messagingMocks = getMessagingMocks();
    supabaseMocks.insertMock.mockClear();
    supabaseMocks.maybeSingleMock.mockClear();
    messagingMocks.getSmsOptStatusMock.mockClear();
    messagingMocks.logOutboundMessageMock.mockClear();
  });

  it('creates reminder rows and logs outbound email', async () => {
    await scheduleAppointmentReminders({
      appointmentId: 'appt-1',
      shopId: 'shop-1',
      customerId: 'cust-1',
      scheduledAt: new Date('2026-01-28T15:00:00Z'),
    });

    const supabaseMocks = getSupabaseMocks();
    const messagingMocks = getMessagingMocks();
    expect(supabaseMocks.insertMock).toHaveBeenCalledTimes(1);
    const reminders = supabaseMocks.insertMock.mock.calls[0][0];
    expect(reminders).toHaveLength(4);
    expect(messagingMocks.logOutboundMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: 'shop-1',
        customerId: 'cust-1',
        channel: 'email',
      })
    );
  });
});
