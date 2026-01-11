import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { Calendar, Clock, Car, Plus, X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Appointment, Vehicle } from '../types/database';

interface AppointmentWithVehicle extends Appointment {
  vehicle?: Vehicle;
}

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
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (customer) {
      loadData();
    }
  }, [customer]);

  const loadData = async () => {
    try {
      const [appointmentsRes, vehiclesRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*')
          .eq('customer_id', customer!.id)
          .order('scheduled_date', { ascending: false }),
        supabase
          .from('vehicles')
          .select('*')
          .eq('customer_id', customer!.id)
          .order('created_at', { ascending: false }),
      ]);

      if (appointmentsRes.error) throw appointmentsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      const appointmentsWithVehicles = (appointmentsRes.data || []).map((apt) => ({
        ...apt,
        vehicle: (vehiclesRes.data || []).find((v) => v.id === apt.vehicle_id),
      }));

      setAppointments(appointmentsWithVehicles);
      setVehicles(vehiclesRes.data || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
      showMessage('error', 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vehicle_id || !formData.scheduled_date || !formData.scheduled_time || !formData.service_type) {
      showMessage('error', 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('appointments').insert({
        customer_id: customer!.id,
        vehicle_id: formData.vehicle_id,
        shop_id: customer!.shop_id,
        scheduled_date: formData.scheduled_date,
        scheduled_time: formData.scheduled_time,
        service_type: formData.service_type,
        description: formData.description || null,
      });

      if (error) throw error;

      showMessage('success', 'Appointment request submitted successfully');
      setShowBooking(false);
      setFormData({
        vehicle_id: '',
        scheduled_date: '',
        scheduled_time: '',
        service_type: '',
        description: '',
      });
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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
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
                  <option value="Oil Change">Oil Change</option>
                  <option value="Tire Rotation">Tire Rotation</option>
                  <option value="Brake Service">Brake Service</option>
                  <option value="Engine Diagnostic">Engine Diagnostic</option>
                  <option value="Transmission Service">Transmission Service</option>
                  <option value="AC Service">AC Service</option>
                  <option value="General Inspection">General Inspection</option>
                  <option value="Other">Other</option>
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
