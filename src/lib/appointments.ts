import { supabase } from './supabase';
import { getSmsOptStatus, logOutboundMessage } from './messaging';

type ReminderPayload = {
  appointmentId: string;
  shopId: string;
  customerId: string;
  scheduledAt: Date;
};

export async function scheduleAppointmentReminders(payload: ReminderPayload) {
  try {
    const reminder24h = new Date(payload.scheduledAt.getTime() - 24 * 60 * 60 * 1000);
    const reminder2h = new Date(payload.scheduledAt.getTime() - 2 * 60 * 60 * 1000);
    const reminders = [
      { channel: 'app', scheduled_at: reminder24h.toISOString() },
      { channel: 'email', scheduled_at: reminder24h.toISOString() },
      { channel: 'app', scheduled_at: reminder2h.toISOString() },
    ];

    const { data: shopSettings } = await supabase
      .from('shop_settings')
      .select('sms_enabled')
      .eq('shop_id', payload.shopId)
      .maybeSingle();

    let smsQueued = false;
    if (shopSettings?.sms_enabled) {
      const smsStatus = await getSmsOptStatus(payload.shopId, payload.customerId);
      if (smsStatus !== 'opted_out') {
        reminders.push({ channel: 'sms', scheduled_at: reminder24h.toISOString() });
        smsQueued = true;
      }
    }

    if (reminders.length > 0) {
      await supabase.from('appointment_reminders').insert(
        reminders.map((reminder) => ({
          appointment_id: payload.appointmentId,
          channel: reminder.channel,
          scheduled_at: reminder.scheduled_at,
          status: 'pending',
        }))
      );
    }

    await logOutboundMessage({
      shopId: payload.shopId,
      customerId: payload.customerId,
      channel: 'email',
      subject: 'Appointment Confirmation',
      body: `Your appointment is scheduled for ${payload.scheduledAt.toLocaleString()}`,
      status: 'queued',
    });

    if (smsQueued) {
      await logOutboundMessage({
        shopId: payload.shopId,
        customerId: payload.customerId,
        channel: 'sms',
        subject: 'Appointment Reminder',
        body: 'Appointment reminder scheduled.',
        status: 'queued',
        segments: 1,
      });
    }
  } catch (error) {
    console.error('Failed to schedule appointment reminders:', error);
  }
}
