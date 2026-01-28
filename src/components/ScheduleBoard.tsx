import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { Calendar, Clock, Plus, User, Car, X, CheckCircle, MapPin, Layers } from 'lucide-react';
import { logAuditEvent } from '../lib/audit';
import { scheduleAppointmentReminders } from '../lib/appointments';
import type { Appointment, AppointmentCapacityRule, AppointmentResource, AppointmentType, Customer, ShopLocation, Vehicle } from '../types/database';

interface AppointmentWithDetails extends Appointment {
  customer?: Customer;
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

export function ScheduleBoard() {
  const { admin } = useAuth();
  const { brandSettings } = useBrand();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [resources, setResources] = useState<AppointmentResource[]>([]);
  const [capacityRules, setCapacityRules] = useState<AppointmentCapacityRule[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    scheduled_date: '',
    scheduled_time: '',
    location_id: '',
    appointment_type_id: '',
    duration_minutes: 30,
    resource_id: '',
    service_type: '',
    description: '',
    status: 'confirmed',
  });
  const [createCustomer, setCreateCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    full_name: '',
    email: '',
    phone: '',
  });
  const [createVehicle, setCreateVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    year: '',
    make: '',
    model: '',
    license_plate: '',
    vin: '',
    color: '',
  });
  const [newType, setNewType] = useState({
    name: '',
    duration_minutes: 30,
    capacity_per_slot: 1,
    color: '#1f2937',
  });
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const normalizeAppointment = (apt: Appointment) => ({
    ...apt,
    scheduled_date: (apt as any).scheduled_date ?? (apt as any).requested_date,
    scheduled_time: (apt as any).scheduled_time ?? (apt as any).requested_time,
  });

  useEffect(() => {
    if (!admin?.shop_id) return;
    loadLocations();
    loadAppointmentTypes();
    loadResources();
    loadCapacityRules();
    loadCustomers();
    loadVehicles();
  }, [admin?.shop_id]);

  useEffect(() => {
    if (!admin?.shop_id) return;
    loadAppointments();
  }, [admin?.shop_id, date, viewMode, selectedLocationId]);

  const loadAppointments = async () => {
    if (!admin?.shop_id) return;
    try {
      setLoading(true);
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
      const allAppointments = (data || []) as Appointment[];
      const dateRange = viewMode === 'week' ? getWeekDates(date) : [date];
      const appointmentsData = allAppointments
        .map((apt) => normalizeAppointment(apt))
        .filter((apt) => dateRange.includes(apt.scheduled_date))
        .filter((apt) => {
          if (!selectedLocationId) return true;
          const locationId = (apt as any).location_id;
          return !locationId || locationId === selectedLocationId;
        });

      const appointmentCustomerIds = [...new Set(appointmentsData.map((a) => a.customer_id))];
      const vehicleIds = [...new Set(appointmentsData.map((a) => a.vehicle_id).filter(Boolean) as string[])];

      const [customersRes, vehiclesRes] = await Promise.all([
        appointmentCustomerIds.length > 0 ? supabase.from('customers').select('*').in('id', appointmentCustomerIds) : Promise.resolve({ data: [], error: null }),
        vehicleIds.length > 0 ? supabase.from('vehicles').select('*').in('id', vehicleIds) : Promise.resolve({ data: [], error: null }),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      const withDetails: AppointmentWithDetails[] = appointmentsData.map((apt) => ({
        ...apt,
        customer: customersRes.data?.find((cust) => cust.id === apt.customer_id),
        vehicle: vehiclesRes.data?.find((veh) => veh.id === apt.vehicle_id),
      }));

      const sorted = withDetails.sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
      setAppointments(sorted);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    if (!admin?.shop_id) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .order('full_name', { ascending: true });
    setCustomers((data || []) as Customer[]);
  };

  const loadVehicles = async () => {
    if (!admin?.shop_id) return;
    const { data: customerRows, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('shop_id', admin.shop_id);
    if (customerError) {
      console.error('Error loading vehicles:', customerError);
      setVehicles([]);
      return;
    }
    const customerIds = (customerRows || []).map((c) => c.id);
    if (customerIds.length === 0) {
      setVehicles([]);
      return;
    }
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading vehicles:', error);
      setVehicles([]);
      return;
    }
    setVehicles((data || []) as Vehicle[]);
  };

  const loadLocations = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('shop_locations')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading locations:', error);
      setLocations([]);
      return;
    }
    const nextLocations = (data || []) as ShopLocation[];
    setLocations(nextLocations);
    if (!selectedLocationId && nextLocations.length > 0) {
      setSelectedLocationId(nextLocations[0].id);
    }
  };

  const loadAppointmentTypes = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('appointment_types')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading appointment types:', error);
      setAppointmentTypes([]);
      return;
    }
    setAppointmentTypes((data || []) as AppointmentType[]);
  };

  const loadResources = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('appointment_resources')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading resources:', error);
      setResources([]);
      return;
    }
    setResources((data || []) as AppointmentResource[]);
  };

  const loadCapacityRules = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('appointment_capacity_rules')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .order('day_of_week', { ascending: true });
    if (error) {
      console.error('Error loading capacity rules:', error);
      setCapacityRules([]);
      return;
    }
    setCapacityRules((data || []) as AppointmentCapacityRule[]);
  };

  const getWeekDates = (dateStr: string) => {
    const current = new Date(`${dateStr}T00:00:00`);
    const day = current.getDay();
    const start = new Date(current);
    start.setDate(current.getDate() - day);
    return Array.from({ length: 7 }).map((_, idx) => {
      const next = new Date(start);
      next.setDate(start.getDate() + idx);
      return next.toISOString().split('T')[0];
    });
  };

  const getCapacityForSlot = (dateStr: string, timeStr: string, typeId?: string | null) => {
    const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
    const rule = capacityRules.find((r) => {
      if (r.day_of_week !== dayOfWeek) return false;
      if (r.location_id && selectedLocationId && r.location_id !== selectedLocationId) return false;
      if (r.appointment_type_id && typeId && r.appointment_type_id !== typeId) return false;
      return timeStr >= r.start_time && timeStr <= r.end_time;
    });
    if (rule) return rule.capacity;
    const type = appointmentTypes.find((t) => t.id === typeId);
    if (type) return type.capacity_per_slot;
    return 1;
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin?.shop_id || !formData.scheduled_date || !formData.scheduled_time || !formData.service_type) {
      showMessage('error', 'Please fill in all required fields');
      return;
    }
    if (locations.length > 0 && !formData.location_id) {
      showMessage('error', 'Select a location');
      return;
    }
    if (!createCustomer && !formData.customer_id) {
      showMessage('error', 'Select an existing customer or add a new one');
      return;
    }

    try {
      let customerId = formData.customer_id;
      if (createCustomer) {
        if (!newCustomer.full_name || !newCustomer.phone) {
          showMessage('error', 'Name and phone are required for a new customer');
          return;
        }

        const { data: createdCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            shop_id: admin.shop_id,
            full_name: newCustomer.full_name,
            email: newCustomer.email || null,
            phone: newCustomer.phone,
            has_account: false,
            is_admin: false,
          })
          .select('*')
          .single();

        if (customerError) throw customerError;
        customerId = createdCustomer.id;
      }

      let vehicleId = formData.vehicle_id || null;
      const hasVehicleInput = Boolean(
        newVehicle.year || newVehicle.make || newVehicle.model || newVehicle.license_plate || newVehicle.vin || newVehicle.color
      );
      if (createVehicle && hasVehicleInput) {
        const createPayload: any = {
          customer_id: customerId,
          year: newVehicle.year ? Number(newVehicle.year) : new Date().getFullYear(),
          make: newVehicle.make || 'Unknown',
          model: newVehicle.model || 'Unknown',
          license_plate: newVehicle.license_plate || null,
          vin: newVehicle.vin || null,
          color: newVehicle.color || null,
        };
        const primaryVehicle = await supabase
          .from('vehicles')
          .insert({ ...createPayload, shop_id: admin.shop_id })
          .select('*')
          .single();
        if (primaryVehicle.error && isMissingColumn(primaryVehicle.error)) {
          const fallbackVehicle = await supabase
            .from('vehicles')
            .insert(createPayload)
            .select('*')
            .single();
          if (fallbackVehicle.error) throw fallbackVehicle.error;
          vehicleId = (fallbackVehicle.data as Vehicle).id;
        } else if (primaryVehicle.error) {
          throw primaryVehicle.error;
        } else {
          vehicleId = (primaryVehicle.data as Vehicle).id;
        }
      }

      const slotCount = appointments.filter((apt) => {
        if (apt.scheduled_date !== formData.scheduled_date) return false;
        if (apt.scheduled_time !== formData.scheduled_time) return false;
        if (formData.location_id && (apt as any).location_id && (apt as any).location_id !== formData.location_id) return false;
        return true;
      }).length;
      const capacity = getCapacityForSlot(formData.scheduled_date, formData.scheduled_time, formData.appointment_type_id || null);
      if (slotCount >= capacity) {
        showMessage('error', 'That time slot is at capacity. Choose another time.');
        return;
      }

      const appointmentPayload: any = {
        customer_id: customerId,
        vehicle_id: vehicleId,
        service_type: formData.service_type,
        description: formData.description || null,
        status: formData.status,
        location_id: formData.location_id || null,
        appointment_type_id: formData.appointment_type_id || null,
        duration_minutes: formData.duration_minutes || null,
        resource_id: formData.resource_id || null,
      };
      const { data: inserted, error: insertError } = await supabase.from('appointments').insert({
        ...appointmentPayload,
        shop_id: admin.shop_id,
        scheduled_date: formData.scheduled_date,
        scheduled_time: formData.scheduled_time,
      }).select('*').single();
      if (insertError) throw insertError;
      if (inserted) {
        await scheduleAppointmentReminders({
          appointmentId: inserted.id,
          shopId: admin.shop_id,
          customerId,
          scheduledAt: new Date(`${formData.scheduled_date}T${formData.scheduled_time}`),
        });
      }

      await logAuditEvent({
        shopId: admin.shop_id,
        actorRole: 'admin',
        eventType: 'appointment_created',
        entityType: 'appointment',
        entityId: inserted?.id || null,
        metadata: { scheduled_date: formData.scheduled_date, scheduled_time: formData.scheduled_time },
      });
      showMessage('success', 'Appointment added');
      setShowAdd(false);
      setFormData({
        customer_id: '',
        vehicle_id: '',
        scheduled_date: '',
        scheduled_time: '',
        location_id: '',
        appointment_type_id: '',
        duration_minutes: 30,
        resource_id: '',
        service_type: '',
        description: '',
        status: 'confirmed',
      });
      setCreateCustomer(false);
      setNewCustomer({ full_name: '', email: '', phone: '' });
      setCreateVehicle(false);
      setNewVehicle({ year: '', make: '', model: '', license_plate: '', vin: '', color: '' });
      loadCustomers();
      loadAppointments();
    } catch (error) {
      console.error('Error adding appointment:', error);
      showMessage('error', 'Failed to add appointment');
    }
  };

  const groupedAppointments = useMemo(() => {
    const groups: Record<string, Record<string, AppointmentWithDetails[]>> = {};
    appointments.forEach((apt) => {
      if (!groups[apt.scheduled_date]) groups[apt.scheduled_date] = {};
      if (!groups[apt.scheduled_date][apt.scheduled_time]) {
        groups[apt.scheduled_date][apt.scheduled_time] = [];
      }
      groups[apt.scheduled_date][apt.scheduled_time].push(apt);
    });
    return groups;
  }, [appointments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading schedule...</div>
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <Layers className="w-4 h-4" />
            <h3 className="font-semibold text-slate-900">Appointment Types</h3>
          </div>
          <button
            onClick={() => setShowTypeForm(!showTypeForm)}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            {showTypeForm ? 'Hide' : 'Add Type'}
          </button>
        </div>
        {showTypeForm && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={newType.name}
              onChange={(e) => setNewType({ ...newType, name: e.target.value })}
              placeholder="Type name"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              type="number"
              min={15}
              step={5}
              value={newType.duration_minutes}
              onChange={(e) => setNewType({ ...newType, duration_minutes: Number(e.target.value) })}
              placeholder="Duration (min)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              type="number"
              min={1}
              value={newType.capacity_per_slot}
              onChange={(e) => setNewType({ ...newType, capacity_per_slot: Number(e.target.value) })}
              placeholder="Capacity"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={async () => {
                if (!admin?.shop_id || !newType.name.trim()) {
                  showMessage('error', 'Enter a type name');
                  return;
                }
                const { error } = await supabase.from('appointment_types').insert({
                  shop_id: admin.shop_id,
                  location_id: selectedLocationId || null,
                  name: newType.name.trim(),
                  duration_minutes: newType.duration_minutes,
                  capacity_per_slot: newType.capacity_per_slot,
                  color: newType.color,
                });
                if (error) {
                  showMessage('error', 'Failed to add appointment type');
                  return;
                }
                showMessage('success', 'Appointment type added');
                setNewType({ name: '', duration_minutes: 30, capacity_per_slot: 1, color: '#1f2937' });
                loadAppointmentTypes();
              }}
              className="px-3 py-2 text-white rounded-lg"
              style={{ backgroundColor: brandSettings.primary_color }}
            >
              Save Type
            </button>
          </div>
        )}
        {appointmentTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            {appointmentTypes.map((type) => (
              <span key={type.id} className="px-2 py-1 bg-slate-100 rounded-full">{type.name}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Schedule</h2>
          <p className="text-slate-600">View and add appointments by day</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-2 rounded-lg text-sm ${viewMode === 'day' ? 'text-white' : 'border border-slate-300 text-slate-600'}`}
              style={viewMode === 'day' ? { backgroundColor: brandSettings.primary_color } : undefined}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-2 rounded-lg text-sm ${viewMode === 'week' ? 'text-white' : 'border border-slate-300 text-slate-600'}`}
              style={viewMode === 'week' ? { backgroundColor: brandSettings.primary_color } : undefined}
            >
              Week
            </button>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg"
          />
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">All locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg"
            style={{ backgroundColor: brandSettings.primary_color }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = brandSettings.secondary_color)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = brandSettings.primary_color)}
          >
            <Plus className="w-4 h-4" />
            Add Appointment
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Manual Appointment</h3>
            <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Customer</label>
                {!createCustomer ? (
                  <>
                    <select
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value, vehicle_id: '' })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                      required
                    >
                      <option value="">Select customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>{customer.full_name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateCustomer(true);
                        setFormData({ ...formData, customer_id: '', vehicle_id: '' });
                      }}
                      className="mt-2 text-sm text-slate-600 hover:text-slate-900 underline"
                    >
                      Add new customer
                    </button>
                  </>
                ) : (
                  <div className="space-y-3 mt-2">
                    <input
                      type="text"
                      placeholder="Full name"
                      value={newCustomer.full_name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      type="email"
                      placeholder="Email (optional)"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setCreateCustomer(false)}
                      className="text-sm text-slate-600 hover:text-slate-900 underline"
                    >
                      Select existing customer instead
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Vehicle</label>
                {!createVehicle ? (
                  <>
                    <select
                      value={formData.vehicle_id}
                      onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="">No vehicle</option>
                      {vehicles.filter((v) => v.customer_id === formData.customer_id).map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-slate-500">Vehicle is optional and can be added later.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateVehicle(true);
                          setFormData({ ...formData, vehicle_id: '' });
                        }}
                        className="text-xs text-slate-600 hover:text-slate-900 underline"
                      >
                        Add vehicle manually
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Year (optional)"
                        value={newVehicle.year}
                        onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Make (optional)"
                        value={newVehicle.make}
                        onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Model (optional)"
                        value={newVehicle.model}
                        onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="License plate (optional)"
                        value={newVehicle.license_plate}
                        onChange={(e) => setNewVehicle({ ...newVehicle, license_plate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="VIN (optional)"
                        value={newVehicle.vin}
                        onChange={(e) => setNewVehicle({ ...newVehicle, vin: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Color (optional)"
                        value={newVehicle.color}
                        onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateVehicle(false)}
                      className="text-xs text-slate-600 hover:text-slate-900 underline"
                    >
                      Select existing vehicle instead
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Date</label>
                <input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Time</label>
                <input
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Location</label>
                <select
                  value={formData.location_id}
                  onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required={locations.length > 0}
                >
                  <option value="">Select location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Appointment Type</label>
                <select
                  value={formData.appointment_type_id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const type = appointmentTypes.find((t) => t.id === nextId);
                    setFormData({
                      ...formData,
                      appointment_type_id: nextId,
                      service_type: type?.name || formData.service_type,
                      duration_minutes: type?.duration_minutes || formData.duration_minutes,
                    });
                  }}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Select type</option>
                  {appointmentTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Service Type</label>
              <select
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              >
                <option value="">Select service type</option>
                {(appointmentTypes.length > 0 ? appointmentTypes.map((t) => t.name) : serviceCatalog).map((service) => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>

            {resources.length > 0 && (
              <div>
                <label className="text-sm font-medium text-slate-700">Assign Resource</label>
                <select
                  value={formData.resource_id}
                  onChange={(e) => setFormData({ ...formData, resource_id: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Unassigned</option>
                  {resources.map((res) => (
                    <option key={res.id} value={res.id}>{res.name} ({res.resource_type})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
                style={{ backgroundColor: brandSettings.primary_color }}
              >
                <CheckCircle className="w-4 h-4" />
                Save Appointment
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {appointments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Appointments</h3>
          <p className="text-slate-600">No appointments scheduled for this day.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(viewMode === 'week' ? getWeekDates(date) : [date]).map((dateKey) => {
            const dayGroups = groupedAppointments[dateKey] || {};
            const timeSlots = Object.entries(dayGroups).sort(([a], [b]) => a.localeCompare(b));
            return (
              <div key={dateKey} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-slate-600 mb-3">
                  <Calendar className="w-4 h-4" />
                  <span className="font-semibold text-slate-800">{dateKey}</span>
                </div>
                {timeSlots.length === 0 ? (
                  <p className="text-sm text-slate-500">No appointments scheduled.</p>
                ) : (
                  <div className="space-y-3">
                    {timeSlots.map(([time, group]) => {
                      const capacity = getCapacityForSlot(dateKey, time, group[0]?.appointment_type_id || null);
                      return (
                        <div key={`${dateKey}-${time}`} className="border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-slate-600 mb-2">
                            <Clock className="w-4 h-4" />
                            <span className="font-semibold text-slate-800">{time}</span>
                            <span className="text-xs text-slate-500">({group.length}/{capacity})</span>
                          </div>
                          <div className="space-y-2">
                            {group.map((apt) => (
                              <div key={apt.id} className="flex items-start justify-between border border-slate-200 rounded-lg p-3 bg-slate-50">
                                <div>
                                  <p className="font-semibold text-slate-900">{apt.service_type}</p>
                                  <div className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1">
                                      <User className="w-4 h-4" />
                                      {apt.customer?.full_name || 'Customer'}
                                    </span>
                                    {apt.vehicle && (
                                      <span className="inline-flex items-center gap-1">
                                        <Car className="w-4 h-4" />
                                        {apt.vehicle.year} {apt.vehicle.make} {apt.vehicle.model}
                                      </span>
                                    )}
                                    {(apt as any).location_id && (
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="w-4 h-4" />
                                        {locations.find((loc) => loc.id === (apt as any).location_id)?.name || 'Location'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${apt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                  {apt.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
