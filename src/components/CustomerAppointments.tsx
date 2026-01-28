import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { Calendar, Clock, Car, Plus, X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Appointment, Vehicle } from '../types/database';

interface AppointmentWithVehicle extends Appointment {
  vehicle?: Vehicle;
}

const serviceCatalog = [
  'Oil Change',
  'Tire Rotation',
  'Brake Service',
  'Engine Diagnostic',
  'Transmission Service',
  'AC Service',
  'General Inspection',
  'Component Replacement',
  'Other',
];

const defaultScheduleSettings = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  appointment_duration_minutes: 30,
  lead_time_minutes: 120,
  bay_count: 1,
  tech_count: 1,
  business_hours: [
    { day: 0, is_open: false, open_time: '08:00', close_time: '17:00' },
    { day: 1, is_open: true, open_time: '08:00', close_time: '17:00' },
    { day: 2, is_open: true, open_time: '08:00', close_time: '17:00' },
    { day: 3, is_open: true, open_time: '08:00', close_time: '17:00' },
    { day: 4, is_open: true, open_time: '08:00', close_time: '17:00' },
    { day: 5, is_open: true, open_time: '08:00', close_time: '17:00' },
    { day: 6, is_open: true, open_time: '09:00', close_time: '13:00' },
  ],
  auto_confirm_services: ['Oil Change', 'Tire Rotation'],
  approval_required_services: ['Engine Diagnostic', 'Component Replacement'],
};

const parseTimeToMinutes = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const getNowInTimeZone = (timeZone: string) => {
  return new Date(new Date().toLocaleString('en-US', { timeZone }));
};

const makeZonedDate = (dateStr: string, timeStr: string, timeZone: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  return new Date(utc.toLocaleString('en-US', { timeZone }));
};

export function CustomerAppointments() {
  const { customer } = useAuth();
  const { brandSettings } = useBrand();
  const [appointments, setAppointments] = useState<AppointmentWithVehicle[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    scheduled_date: '',
    scheduled_time: '',
    service_type: '',
    description: '',
  });
  const [scheduleSettings, setScheduleSettings] = useState(defaultScheduleSettings);
  const [alternativeSlots, setAlternativeSlots] = useState<{ date: string; time: string }[]>([]);
  const [slotMessage, setSlotMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isMissingColumn = (error: any) =>
    error?.code === '42703' || (typeof error?.message === 'string' && error.message.includes('does not exist'));

  const normalizeAppointment = (apt: Appointment) => ({
    ...apt,
    scheduled_date: (apt as any).scheduled_date ?? (apt as any).requested_date,
    scheduled_time: (apt as any).scheduled_time ?? (apt as any).requested_time,
  });

  useEffect(() => {
    if (customer) {
      loadData();
    }
  }, [customer]);

  const loadData = async () => {
    try {
      const appointmentsPrimary = await supabase
        .from('appointments')
        .select('*')
        .eq('customer_id', customer!.id)
        .order('scheduled_date', { ascending: false });

      const appointmentsRes = appointmentsPrimary.error && isMissingColumn(appointmentsPrimary.error)
        ? await supabase
          .from('appointments')
          .select('*')
          .eq('customer_id', customer!.id)
          .order('requested_date', { ascending: false })
        : appointmentsPrimary;

      const [vehiclesRes, settingsRes] = await Promise.all([
        supabase
          .from('vehicles')
          .select('*')
          .eq('customer_id', customer!.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('shop_settings')
          .select('*')
          .eq('shop_id', customer!.shop_id)
          .maybeSingle(),
      ]);

      if (appointmentsRes.error) throw appointmentsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (settingsRes.error) throw settingsRes.error;

      const appointmentsWithVehicles = (appointmentsRes.data || []).map((apt) => ({
        ...normalizeAppointment(apt as Appointment),
        vehicle: (vehiclesRes.data || []).find((v) => v.id === apt.vehicle_id),
      }));

      setAppointments(appointmentsWithVehicles);
      setVehicles(vehiclesRes.data || []);
      if (settingsRes.data) {
        setScheduleSettings({
          timezone: settingsRes.data.timezone || defaultScheduleSettings.timezone,
          appointment_duration_minutes: Number(settingsRes.data.appointment_duration_minutes || defaultScheduleSettings.appointment_duration_minutes),
          lead_time_minutes: Number(settingsRes.data.lead_time_minutes || defaultScheduleSettings.lead_time_minutes),
          bay_count: Number(settingsRes.data.bay_count || defaultScheduleSettings.bay_count),
          tech_count: Number(settingsRes.data.tech_count || defaultScheduleSettings.tech_count),
          business_hours: settingsRes.data.business_hours || defaultScheduleSettings.business_hours,
          auto_confirm_services: settingsRes.data.auto_confirm_services || defaultScheduleSettings.auto_confirm_services,
          approval_required_services: settingsRes.data.approval_required_services || defaultScheduleSettings.approval_required_services,
        });
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
      showMessage('error', 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const getCapacity = () => {
    const bayCount = Number(scheduleSettings.bay_count || 1);
    const techCount = Number(scheduleSettings.tech_count || 1);
    return Math.max(1, Math.min(bayCount, techCount));
  };

  const getBusinessHoursForDate = (dateStr: string) => {
    const dayIndex = makeZonedDate(dateStr, '00:00', scheduleSettings.timezone).getDay();
    return scheduleSettings.business_hours.find((d: any) => d.day === dayIndex);
  };

  const isWithinBusinessHours = (dateStr: string, timeStr: string) => {
    const hours = getBusinessHoursForDate(dateStr);
    if (!hours || !hours.is_open) return false;
    const timeMinutes = parseTimeToMinutes(timeStr);
    return timeMinutes >= parseTimeToMinutes(hours.open_time) && timeMinutes + scheduleSettings.appointment_duration_minutes <= parseTimeToMinutes(hours.close_time);
  };

  const isAfterLeadTime = (dateStr: string, timeStr: string) => {
    const now = getNowInTimeZone(scheduleSettings.timezone);
    const leadMs = scheduleSettings.lead_time_minutes * 60 * 1000;
    const requested = makeZonedDate(dateStr, timeStr, scheduleSettings.timezone);
    return requested.getTime() - now.getTime() >= leadMs;
  };

  const fetchAppointmentsForRange = async (startDate: string, endDate: string) => {
    const primary = await supabase
      .from('appointments')
      .select('scheduled_date, scheduled_time, status, requested_date, requested_time')
      .eq('shop_id', customer!.shop_id)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .neq('status', 'cancelled');

    if (primary.error && isMissingColumn(primary.error)) {
      const fallback = await supabase
        .from('appointments')
        .select('requested_date, requested_time, status')
        .eq('customer_id', customer!.id)
        .gte('requested_date', startDate)
        .lte('requested_date', endDate)
        .neq('status', 'cancelled');
      if (fallback.error) throw fallback.error;
      return (fallback.data || []).map((apt: any) => ({
        scheduled_date: apt.requested_date,
        scheduled_time: apt.requested_time,
        status: apt.status,
      }));
    }
    if (primary.error) throw primary.error;
    return (primary.data || []).map((apt: any) => ({
      scheduled_date: apt.scheduled_date ?? apt.requested_date,
      scheduled_time: apt.scheduled_time ?? apt.requested_time,
      status: apt.status,
    }));
  };

  const isSlotAvailable = (dateStr: string, timeStr: string, appointmentsData: any[]) => {
    const count = appointmentsData.filter((apt) => apt.scheduled_date === dateStr && apt.scheduled_time === timeStr).length;
    return count < getCapacity();
  };

  const findAlternativeSlots = (dateStr: string, timeStr: string, appointmentsData: any[]) => {
    const alternatives: { date: string; time: string }[] = [];
    const startDate = new Date(`${dateStr}T00:00:00`);
    const duration = scheduleSettings.appointment_duration_minutes;

    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + offset);
      const candidateDate = date.toISOString().split('T')[0];
      const hours = getBusinessHoursForDate(candidateDate);
      if (!hours || !hours.is_open) continue;

      const openMinutes = parseTimeToMinutes(hours.open_time);
      const closeMinutes = parseTimeToMinutes(hours.close_time);
      for (let t = openMinutes; t + duration <= closeMinutes; t += duration) {
        const slotTime = minutesToTime(t);
        if (offset === 0 && slotTime <= timeStr) continue;
        if (!isAfterLeadTime(candidateDate, slotTime)) continue;
        if (!isSlotAvailable(candidateDate, slotTime, appointmentsData)) continue;
        alternatives.push({ date: candidateDate, time: slotTime });
        if (alternatives.length >= 5) return alternatives;
      }
    }
    return alternatives;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vehicle_id || !formData.scheduled_date || !formData.scheduled_time || !formData.service_type) {
      showMessage('error', 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      setSlotMessage(null);
      setAlternativeSlots([]);

      if (!isWithinBusinessHours(formData.scheduled_date, formData.scheduled_time)) {
        showMessage('error', 'That time is outside of our business hours.');
        setSubmitting(false);
        return;
      }

      if (!isAfterLeadTime(formData.scheduled_date, formData.scheduled_time)) {
        const hours = Math.ceil(scheduleSettings.lead_time_minutes / 60);
        showMessage('error', `Please choose a time at least ${hours} hours from now.`);
        setSubmitting(false);
        return;
      }

      const startDate = formData.scheduled_date;
      const endDate = new Date(new Date(startDate).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const rangeAppointments = await fetchAppointmentsForRange(startDate, endDate);

      if (!isSlotAvailable(formData.scheduled_date, formData.scheduled_time, rangeAppointments)) {
        const alternatives = findAlternativeSlots(formData.scheduled_date, formData.scheduled_time, rangeAppointments);
        setAlternativeSlots(alternatives);
        setSlotMessage(alternatives.length > 0
          ? 'That time is not available. Choose one of these open slots or call to verify scheduling.'
          : 'That time is not available. Please call the shop to verify scheduling.');
        setSubmitting(false);
        return;
      }

      const autoConfirm = scheduleSettings.auto_confirm_services.includes(formData.service_type)
        && !scheduleSettings.approval_required_services.includes(formData.service_type);

      const payload: any = {
        customer_id: customer!.id,
        vehicle_id: formData.vehicle_id,
        service_type: formData.service_type,
        description: formData.description || null,
        status: autoConfirm ? 'confirmed' : 'pending',
      };
      const primaryInsert = await supabase.from('appointments').insert({
        ...payload,
        shop_id: customer!.shop_id,
        scheduled_date: formData.scheduled_date,
        scheduled_time: formData.scheduled_time,
      });
      if (primaryInsert.error && isMissingColumn(primaryInsert.error)) {
        const fallbackInsert = await supabase.from('appointments').insert({
          ...payload,
          requested_date: formData.scheduled_date,
          requested_time: formData.scheduled_time,
        });
        if (fallbackInsert.error) throw fallbackInsert.error;
      } else if (primaryInsert.error) {
        throw primaryInsert.error;
      }

      showMessage('success', 'Appointment request submitted successfully');
      setShowBooking(false);
      setFormData({
        vehicle_id: '',
        scheduled_date: '',
        scheduled_time: '',
        service_type: '',
        description: '',
      });
      setAlternativeSlots([]);
      setSlotMessage(null);
      loadData();
    } catch (error) {
      console.error('Error booking appointment:', error);
      showMessage('error', 'Failed to book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          cancelled_reason: 'Cancelled by customer'
        })
        .eq('id', appointmentId);

      if (error) throw error;

      showMessage('success', 'Appointment cancelled');
      loadData();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      showMessage('error', 'Failed to cancel appointment');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
            <AlertCircle className="w-4 h-4" />
            Pending
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-sm font-medium rounded-full">
            <CheckCircle className="w-4 h-4" />
            Confirmed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
            <XCircle className="w-4 h-4" />
            Cancelled
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
            <CheckCircle className="w-4 h-4" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getMinDate = () => {
    const now = getNowInTimeZone(scheduleSettings.timezone);
    const minDate = new Date(now.getTime() + scheduleSettings.lead_time_minutes * 60 * 1000);
    return minDate.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading appointments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Appointments</h2>
          <p className="text-slate-600">Schedule and manage your service appointments</p>
        </div>
        <button
          onClick={() => setShowBooking(true)}
          disabled={vehicles.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Book Appointment
        </button>
      </div>

      {vehicles.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            You need to add a vehicle before booking an appointment. Contact us to add your vehicle information.
          </p>
        </div>
      )}

      {showBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Book Appointment</h3>
              <button
                onClick={() => setShowBooking(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Vehicle <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  required
                >
                  <option value="">Select a vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Preferred Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  min={getMinDate()}
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Preferred Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              {slotMessage && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  {slotMessage}
                  {alternativeSlots.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {alternativeSlots.map((slot) => (
                        <button
                          key={`${slot.date}-${slot.time}`}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, scheduled_date: slot.date, scheduled_time: slot.time });
                            setSlotMessage(null);
                            setAlternativeSlots([]);
                          }}
                          className="px-3 py-1.5 bg-white border border-yellow-200 rounded-lg text-xs text-slate-700 hover:bg-yellow-100"
                        >
                          {slot.date} {slot.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Service Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  required
                >
                  <option value="">Select service type</option>
                  {serviceCatalog.map((service) => (
                    <option key={service} value={service}>{service}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Additional Details
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe any specific issues or concerns..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBooking(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
                >
                  {submitting ? 'Booking...' : 'Book Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {appointments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Appointments</h3>
            <p className="text-slate-600">You haven't booked any appointments yet.</p>
          </div>
        ) : (
          appointments.map((appointment) => (
            <div key={appointment.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{appointment.service_type}</h3>
                    {getStatusBadge(appointment.status)}
                  </div>

                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(appointment.scheduled_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{formatTime(appointment.scheduled_time)}</span>
                    </div>
                    {appointment.vehicle && (
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4" />
                        <span>
                          {appointment.vehicle.year} {appointment.vehicle.make} {appointment.vehicle.model}
                        </span>
                      </div>
                    )}
                  </div>

                  {appointment.description && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-700">{appointment.description}</p>
                    </div>
                  )}

                  {appointment.admin_notes && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-1">Admin Notes:</p>
                      <p className="text-sm text-blue-800">{appointment.admin_notes}</p>
                    </div>
                  )}

                  {appointment.cancelled_reason && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-900 mb-1">Cancellation Reason:</p>
                      <p className="text-sm text-red-800">{appointment.cancelled_reason}</p>
                    </div>
                  )}
                </div>
              </div>

              {appointment.status === 'pending' && (
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleCancel(appointment.id)}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 font-medium rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel Appointment
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
