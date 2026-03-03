import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { Calendar, List, LayoutGrid, Download, SlidersHorizontal } from 'lucide-react';
import { logAuditEvent } from '../lib/audit';
import { logOutboundMessage } from '../lib/messaging';
import type { Appointment, AppointmentType, Customer, ShopLocation, Vehicle } from '../types/database';
import { ConfirmAppointmentModal, CancelAppointmentModal, EditAppointmentModal, SendReminderModal } from './appointments/AppointmentModals';
import { CalendarView } from './appointments/CalendarView';
import { BoardView } from './appointments/BoardView';
import { GroupedListView } from './appointments/GroupedListView';
import { AppointmentFilters } from './appointments/AppointmentFilters';
import { BulkActionsBar } from './appointments/BulkActionsBar';
import { exportAppointmentsToCSV, filterAppointments } from '../lib/appointmentUtils';

interface AppointmentWithDetails extends Appointment {
  customer?: Customer;
  vehicle?: Vehicle;
  repair_order_id?: string | null;
  selected?: boolean;
}

const generateRoNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RO-${datePart}-${rand}`;
};

export function AppointmentsManagement() {
  const { admin } = useAuth();
  const { brandSettings } = useBrand();
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'board'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedAppointmentType, setSelectedAppointmentType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; appointment: AppointmentWithDetails | null }>({ isOpen: false, appointment: null });
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; appointment: AppointmentWithDetails | null }>({ isOpen: false, appointment: null });
  const [editModal, setEditModal] = useState<{ isOpen: boolean; appointment: AppointmentWithDetails | null }>({ isOpen: false, appointment: null });
  const [reminderModal, setReminderModal] = useState<{ isOpen: boolean; appointment: AppointmentWithDetails | null }>({ isOpen: false, appointment: null });

  const normalizeAppointment = (apt: Appointment) => ({
    ...apt,
    scheduled_date: (apt as any).scheduled_date ?? (apt as any).requested_date,
    scheduled_time: (apt as any).scheduled_time ?? (apt as any).requested_time,
  });

  useEffect(() => {
    loadAppointments();
    loadLocations();
    loadAppointmentTypes();
    if (!admin?.shop_id) return;
    const channel = supabase
      .channel(`admin-appointments-${admin.shop_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
      }, () => {
        loadAppointments();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [admin?.shop_id]);

  const loadLocations = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('shop_locations')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .order('created_at', { ascending: true });
    if (!error) setLocations((data || []) as ShopLocation[]);
  };

  const loadAppointmentTypes = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('appointment_types')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .order('created_at', { ascending: true });
    if (!error) setAppointmentTypes((data || []) as AppointmentType[]);
  };

  const loadAppointments = async () => {
    try {
      let appointmentsData: Appointment[] = [];
      if (admin?.shop_id) {
        const { data: customerRows, error: customerError } = await supabase
          .from('customers')
          .select('id')
          .eq('shop_id', admin.shop_id);
        if (customerError) throw customerError;
        const customerIds = (customerRows || []).map((c) => c.id);
        if (customerIds.length === 0) {
          setAppointments([]);
          return;
        }
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .in('customer_id', customerIds);
        if (error) throw error;
        appointmentsData = (data || []) as Appointment[];
      } else {
        const { data, error } = await supabase
          .from('appointments')
          .select('*');
        if (error) throw error;
        appointmentsData = (data || []) as Appointment[];
      }

      const customerIds = [...new Set(appointmentsData.map((a) => a.customer_id) || [])];
      const vehicleIds = [...new Set(appointmentsData.map((a) => a.vehicle_id).filter(Boolean) || [])];
      const appointmentIds = [...new Set(appointmentsData.map((a) => a.id) || [])];

      const [customersRes, vehiclesRes, repairOrdersRes] = await Promise.all([
        supabase.from('customers').select('*').in('id', customerIds),
        vehicleIds.length > 0 ? supabase.from('vehicles').select('*').in('id', vehicleIds) : Promise.resolve({ data: [], error: null }),
        appointmentIds.length > 0 ? supabase.from('repair_orders').select('id, appointment_id').in('appointment_id', appointmentIds) : Promise.resolve({ data: [], error: null }),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (repairOrdersRes.error) {
        const notFound = repairOrdersRes.error.code === '42P01'
          || repairOrdersRes.error.code === '404'
          || repairOrdersRes.error.message?.includes('repair_orders')
          || repairOrdersRes.error.message?.includes('Not Found');
        if (!notFound) throw repairOrdersRes.error;
      }

      const appointmentsWithDetails = appointmentsData.map((apt) => ({
        ...normalizeAppointment(apt),
        customer: customersRes.data?.find((c) => c.id === apt.customer_id),
        vehicle: vehiclesRes.data?.find((v) => v.id === apt.vehicle_id),
        repair_order_id: repairOrdersRes.data?.find((ro) => ro.appointment_id === apt.id)?.id || null,
        selected: false,
      }));

      const sorted = appointmentsWithDetails.sort((a, b) => {
        const dateA = a.scheduled_date || '';
        const dateB = b.scheduled_date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const timeA = a.scheduled_time || '';
        const timeB = b.scheduled_time || '';
        return timeA.localeCompare(timeB);
      });

      setAppointments(sorted);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (appointmentId: string, newStatus: 'confirmed' | 'cancelled' | 'completed', notes?: string, cancellationType?: 'cancelled' | 'no-show') => {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'confirmed') {
        updateData.confirmed_by = admin!.id;
        updateData.confirmed_at = new Date().toISOString();
        if (notes) updateData.admin_notes = notes;
      } else if (newStatus === 'cancelled') {
        if (notes) updateData.cancelled_reason = notes;
        if (cancellationType) updateData.cancellation_type = cancellationType;
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;

      if (admin?.shop_id) {
        await logAuditEvent({
          shopId: admin.shop_id,
          actorRole: 'admin',
          eventType: `appointment_${newStatus}`,
          entityType: 'appointment',
          entityId: appointmentId,
          metadata: { status: newStatus },
        });
      }

      if (admin?.shop_id && newStatus === 'confirmed') {
        const appointment = appointments.find((apt) => apt.id === appointmentId);
        if (appointment?.customer_id) {
          await logOutboundMessage({
            shopId: admin.shop_id,
            customerId: appointment.customer_id,
            channel: 'email',
            subject: 'Appointment confirmed',
            body: 'Your appointment has been confirmed by the shop.',
            status: 'queued',
          });
        }
      }

      showMessage('success', `Appointment ${newStatus}`);
      loadAppointments();
      window.dispatchEvent(new CustomEvent('appointments:refresh'));

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

  const handleEditAppointment = async (appointmentId: string, updates: Partial<Appointment>) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId);

      if (error) throw error;

      showMessage('success', 'Appointment updated');
      loadAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
      showMessage('error', 'Failed to update appointment');
    }
  };

  const handleCreateRepairOrder = async (appointment: AppointmentWithDetails) => {
    try {
      if (!admin?.shop_id) return;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('repair_orders')
        .insert({
          shop_id: admin.shop_id,
          customer_id: appointment.customer_id,
          vehicle_id: appointment.vehicle_id,
          appointment_id: appointment.id,
          status: 'draft',
          ro_number: generateRoNumber(),
          customer_notes: appointment.description || null,
          labor_total: 0,
          parts_total: 0,
          fees_total: 0,
          tax_total: 0,
          grand_total: 0,
          created_at: now,
          updated_at: now,
        });

      if (error) throw error;
      showMessage('success', 'Repair order created');
      loadAppointments();
    } catch (error) {
      console.error('Error creating repair order:', error);
      showMessage('error', 'Failed to create repair order');
    }
  };

  const handleSendReminder = async (channel: 'email' | 'sms', message: string, appointment: AppointmentWithDetails) => {
    try {
      if (!admin?.shop_id || !appointment.customer_id) return;

      await logOutboundMessage({
        shopId: admin.shop_id,
        customerId: appointment.customer_id,
        channel,
        subject: 'Appointment Reminder',
        body: message,
        status: 'queued',
      });

      showMessage('success', `Reminder sent via ${channel}`);
    } catch (error) {
      console.error('Error sending reminder:', error);
      showMessage('error', 'Failed to send reminder');
    }
  };

  const handleToggleSelect = (appointmentId: string) => {
    setAppointments(prev =>
      prev.map(apt =>
        apt.id === appointmentId ? { ...apt, selected: !apt.selected } : apt
      )
    );
  };

  const handleClearSelection = () => {
    setAppointments(prev => prev.map(apt => ({ ...apt, selected: false })));
  };

  const selectedAppointments = appointments.filter(apt => apt.selected);

  const handleBulkConfirm = async () => {
    for (const apt of selectedAppointments) {
      if (apt.status === 'pending') {
        await handleUpdateStatus(apt.id, 'confirmed');
      }
    }
    handleClearSelection();
  };

  const handleBulkCancel = async () => {
    for (const apt of selectedAppointments) {
      if (apt.status !== 'cancelled') {
        await handleUpdateStatus(apt.id, 'cancelled', undefined, 'cancelled');
      }
    }
    handleClearSelection();
  };

  const handleBulkSendReminders = async () => {
    for (const apt of selectedAppointments) {
      if (apt.customer?.email) {
        await handleSendReminder('email', 'This is a reminder about your upcoming appointment.', apt);
      }
    }
    handleClearSelection();
  };

  const handleExportSelected = () => {
    const toExport = selectedAppointments.length > 0 ? selectedAppointments : filteredAppointments;
    exportAppointmentsToCSV(toExport);
    if (selectedAppointments.length > 0) {
      handleClearSelection();
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedLocation('');
    setSelectedAppointmentType('');
    setDateFrom('');
    setDateTo('');
  };

  let filteredAppointments = filterAppointments(
    appointments,
    searchQuery,
    selectedLocation,
    selectedAppointmentType,
    dateFrom,
    dateTo
  );

  if (filter !== 'all') {
    filteredAppointments = filteredAppointments.filter(apt => apt.status === filter);
  }

  const pendingCount = appointments.filter((a) => a.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading appointments...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
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
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2">
              <span className="font-semibold text-yellow-900">{pendingCount} pending</span>
            </div>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              showFilters ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            style={showFilters ? { backgroundColor: brandSettings.primary_color } : undefined}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={handleExportSelected}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {showFilters && (
        <AppointmentFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
          selectedAppointmentType={selectedAppointmentType}
          onAppointmentTypeChange={setSelectedAppointmentType}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          locations={locations}
          appointmentTypes={appointmentTypes}
          onClearFilters={handleClearFilters}
          brandColor={brandSettings.primary_color}
        />
      )}

      <div className="flex items-center justify-between">
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

        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            style={viewMode === 'list' ? { backgroundColor: brandSettings.primary_color } : undefined}
            title="List View"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'calendar' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            style={viewMode === 'calendar' ? { backgroundColor: brandSettings.primary_color } : undefined}
            title="Calendar View"
          >
            <Calendar className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('board')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'board' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            style={viewMode === 'board' ? { backgroundColor: brandSettings.primary_color } : undefined}
            title="Board View"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Appointments</h3>
          <p className="text-slate-600">
            {filter === 'all' ? 'No appointments found.' : `No ${filter} appointments found.`}
          </p>
        </div>
      ) : (
        <>
          {viewMode === 'list' && (
            <GroupedListView
              appointments={filteredAppointments}
              locations={locations}
              appointmentTypes={appointmentTypes}
              onAppointmentClick={(apt) => {}}
              onConfirm={(apt) => setConfirmModal({ isOpen: true, appointment: apt })}
              onCancel={(apt) => setCancelModal({ isOpen: true, appointment: apt })}
              onComplete={(apt) => handleUpdateStatus(apt.id, 'completed')}
              onNoShow={(apt) => setCancelModal({ isOpen: true, appointment: apt })}
              onEdit={(apt) => setEditModal({ isOpen: true, appointment: apt })}
              onSendReminder={(apt) => setReminderModal({ isOpen: true, appointment: apt })}
              onCreateRO={handleCreateRepairOrder}
              onToggleSelect={handleToggleSelect}
              brandColor={brandSettings.primary_color}
            />
          )}

          {viewMode === 'calendar' && (
            <CalendarView
              appointments={filteredAppointments}
              locations={locations}
              onAppointmentClick={(apt) => setEditModal({ isOpen: true, appointment: apt })}
              brandColor={brandSettings.primary_color}
            />
          )}

          {viewMode === 'board' && (
            <BoardView
              appointments={filteredAppointments}
              locations={locations}
              onAppointmentClick={(apt) => setEditModal({ isOpen: true, appointment: apt })}
              onStatusChange={(id, status) => handleUpdateStatus(id, status as any)}
              brandColor={brandSettings.primary_color}
            />
          )}
        </>
      )}

      <BulkActionsBar
        selectedCount={selectedAppointments.length}
        onConfirmSelected={handleBulkConfirm}
        onCancelSelected={handleBulkCancel}
        onDeleteSelected={() => {}}
        onExportSelected={handleExportSelected}
        onSendRemindersSelected={handleBulkSendReminders}
        onClearSelection={handleClearSelection}
        brandColor={brandSettings.primary_color}
      />

      <ConfirmAppointmentModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, appointment: null })}
        onConfirm={(notes) => {
          if (confirmModal.appointment) {
            handleUpdateStatus(confirmModal.appointment.id, 'confirmed', notes);
          }
        }}
        brandColor={brandSettings.primary_color}
      />

      <CancelAppointmentModal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal({ isOpen: false, appointment: null })}
        onCancel={(reason, type) => {
          if (cancelModal.appointment) {
            handleUpdateStatus(cancelModal.appointment.id, 'cancelled', reason, type);
          }
        }}
      />

      {editModal.appointment && (
        <EditAppointmentModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, appointment: null })}
          onSave={(updates) => {
            if (editModal.appointment) {
              handleEditAppointment(editModal.appointment.id, updates);
            }
          }}
          appointment={editModal.appointment}
          locations={locations}
          appointmentTypes={appointmentTypes}
          brandColor={brandSettings.primary_color}
        />
      )}

      {reminderModal.appointment && (
        <SendReminderModal
          isOpen={reminderModal.isOpen}
          onClose={() => setReminderModal({ isOpen: false, appointment: null })}
          onSend={(channel, message) => {
            if (reminderModal.appointment) {
              handleSendReminder(channel, message, reminderModal.appointment);
            }
          }}
          customerEmail={reminderModal.appointment.customer?.email}
          customerPhone={reminderModal.appointment.customer?.phone}
          brandColor={brandSettings.primary_color}
        />
      )}
    </div>
  );
}
