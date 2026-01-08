import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { Calendar, Clock, Car, User, CheckCircle, XCircle, AlertCircle, Edit2, Save, X } from 'lucide-react';
import type { Appointment, Customer, Vehicle } from '../types/database';

interface AppointmentWithDetails extends Appointment {
  customer?: Customer;
  vehicle?: Vehicle;
}

export function AppointmentsManagement() {
  const { customer: admin } = useAuth();
  const { brandSettings } = useBrand();
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadAppointments();

    const interval = setInterval(loadAppointments, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAppointments = async () => {
    try {
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .order('requested_date', { ascending: true })
        .order('requested_time', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      const customerIds = [...new Set(appointmentsData?.map((a) => a.customer_id) || [])];
      const vehicleIds = [...new Set(appointmentsData?.map((a) => a.vehicle_id).filter(Boolean) || [])];

      const [customersRes, vehiclesRes] = await Promise.all([
        supabase.from('customers').select('*').in('id', customerIds),
        vehicleIds.length > 0 ? supabase.from('vehicles').select('*').in('id', vehicleIds) : Promise.resolve({ data: [], error: null }),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      const appointmentsWithDetails = (appointmentsData || []).map((apt) => ({
        ...apt,
        customer: customersRes.data?.find((c) => c.id === apt.customer_id),
        vehicle: vehiclesRes.data?.find((v) => v.id === apt.vehicle_id),
      }));

      setAppointments(appointmentsWithDetails);
    } catch (error) {
      console.error('Error loading appointments:', error);
      showMessage('error', 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (appointmentId: string, newStatus: 'confirmed' | 'cancelled' | 'completed', notes?: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'confirmed') {
        updateData.confirmed_by = admin!.id;
        updateData.confirmed_at = new Date().toISOString();
        if (notes) updateData.admin_notes = notes;
      } else if (newStatus === 'cancelled' && notes) {
        updateData.cancelled_reason = notes;
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;

      showMessage('success', `Appointment ${newStatus}`);
      setEditingId(null);
      setAdminNotes('');
      loadAppointments();

      if (Notification.permission === 'granted') {
        new Notification('Appointment Updated', {
          body: `Appointment has been ${newStatus}`,
          icon: '/favicon.ico',
        });
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
      showMessage('error', 'Failed to update appointment');
    }
  };

  const handleSaveNotes = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          admin_notes: adminNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId);

      if (error) throw error;

      showMessage('success', 'Notes saved');
      setEditingId(null);
      setAdminNotes('');
      loadAppointments();
    } catch (error) {
      console.error('Error saving notes:', error);
      showMessage('error', 'Failed to save notes');
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
          <span
            className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full"
            style={{
              backgroundColor: `${brandSettings.primary_color}20`,
              color: brandSettings.primary_color
            }}
          >
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

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === 'all') return true;
    return apt.status === filter;
  });

  const pendingCount = appointments.filter((a) => a.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading appointments...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      {message && (
        <div
          className="p-4 rounded-lg"
          style={message.type === 'success' ? {
            backgroundColor: `${brandSettings.primary_color}10`,
            color: brandSettings.primary_color
          } : { backgroundColor: '#fef2f2', color: '#991b1b' }}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Appointments</h2>
          <p className="text-slate-600">Manage customer appointment requests</p>
        </div>
        {pendingCount > 0 && (
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2">
            <span className="font-semibold text-yellow-900">{pendingCount} pending</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'confirmed', 'cancelled', 'completed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? 'text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            style={filter === status ? { backgroundColor: brandSettings.primary_color } : undefined}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'pending' && pendingCount > 0 && (
              <span className="ml-2 bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Appointments</h3>
            <p className="text-slate-600">
              {filter === 'all' ? 'No appointments found.' : `No ${filter} appointments found.`}
            </p>
          </div>
        ) : (
          filteredAppointments.map((appointment) => (
            <div key={appointment.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-slate-900">{appointment.service_type}</h3>
                    {getStatusBadge(appointment.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2 text-sm">
                      {appointment.customer && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-900 font-medium">{appointment.customer.full_name}</span>
                        </div>
                      )}
                      {appointment.customer?.email && (
                        <div className="text-slate-600 ml-6">{appointment.customer.email}</div>
                      )}
                      {appointment.customer?.phone && (
                        <div className="text-slate-600 ml-6">{appointment.customer.phone}</div>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-900">{formatDate(appointment.requested_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-900">{formatTime(appointment.requested_time)}</span>
                      </div>
                      {appointment.vehicle && (
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-900">
                            {appointment.vehicle.year} {appointment.vehicle.make} {appointment.vehicle.model}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {appointment.description && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm font-medium text-slate-700 mb-1">Customer Notes:</p>
                      <p className="text-sm text-slate-600">{appointment.description}</p>
                    </div>
                  )}

                  {editingId === appointment.id ? (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <label className="block text-sm font-medium text-blue-900 mb-2">Admin Notes:</label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={3}
                        placeholder="Add notes about this appointment..."
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleSaveNotes(appointment.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setAdminNotes('');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : appointment.admin_notes ? (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-blue-900">Admin Notes:</p>
                        <button
                          onClick={() => {
                            setEditingId(appointment.id);
                            setAdminNotes(appointment.admin_notes || '');
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-blue-800">{appointment.admin_notes}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(appointment.id);
                        setAdminNotes('');
                      }}
                      className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <Edit2 className="w-4 h-4" />
                      Add Admin Notes
                    </button>
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
                <div className="flex gap-2 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleUpdateStatus(appointment.id, 'confirmed')}
                    className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-colors"
                    style={{ backgroundColor: brandSettings.primary_color }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = brandSettings.secondary_color}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = brandSettings.primary_color}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Enter cancellation reason:');
                      if (reason) handleUpdateStatus(appointment.id, 'cancelled', reason);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              )}

              {appointment.status === 'confirmed' && (
                <div className="flex gap-2 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleUpdateStatus(appointment.id, 'completed')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Complete
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
