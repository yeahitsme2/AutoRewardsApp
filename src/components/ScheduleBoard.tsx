import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { Calendar, Clock, Plus, User, Car, X, CheckCircle } from 'lucide-react';
import type { Appointment, Customer, Vehicle } from '../types/database';

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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isMissingColumn = (error: any) =>
    error?.code === '42703' || (typeof error?.message === 'string' && error.message.includes('does not exist'));

  const normalizeAppointment = (apt: Appointment) => ({
    ...apt,
    scheduled_date: (apt as any).scheduled_date ?? (apt as any).requested_date,
    scheduled_time: (apt as any).scheduled_time ?? (apt as any).requested_time,
  });

  useEffect(() => {
    if (!admin?.shop_id) return;
    loadAppointments();
    loadCustomers();
    loadVehicles();
  }, [admin?.shop_id, date]);

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
      const appointmentsData = allAppointments
        .map((apt) => normalizeAppointment(apt))
        .filter((apt) => apt.scheduled_date === date);

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

      const appointmentPayload: any = {
        customer_id: customerId,
        vehicle_id: vehicleId,
        service_type: formData.service_type,
        description: formData.description || null,
        status: formData.status,
      };
      const primaryAppointment = await supabase.from('appointments').insert({
        ...appointmentPayload,
        shop_id: admin.shop_id,
        scheduled_date: formData.scheduled_date,
        scheduled_time: formData.scheduled_time,
      });
      if (primaryAppointment.error && isMissingColumn(primaryAppointment.error)) {
        const fallbackAppointment = await supabase.from('appointments').insert({
          ...appointmentPayload,
          requested_date: formData.scheduled_date,
          requested_time: formData.scheduled_time,
        });
        if (fallbackAppointment.error) throw fallbackAppointment.error;
      } else if (primaryAppointment.error) {
        throw primaryAppointment.error;
      }
      showMessage('success', 'Appointment added');
      setShowAdd(false);
      setFormData({
        customer_id: '',
        vehicle_id: '',
        scheduled_date: '',
        scheduled_time: '',
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
    const groups: Record<string, AppointmentWithDetails[]> = {};
    appointments.forEach((apt) => {
      if (!groups[apt.scheduled_time]) groups[apt.scheduled_time] = [];
      groups[apt.scheduled_time].push(apt);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Schedule</h2>
          <p className="text-slate-600">View and add appointments by day</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg"
          />
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
                {serviceCatalog.map((service) => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>

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

      {groupedAppointments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Appointments</h3>
          <p className="text-slate-600">No appointments scheduled for this day.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedAppointments.map(([time, group]) => (
            <div key={time} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-600 mb-3">
                <Clock className="w-4 h-4" />
                <span className="font-semibold text-slate-800">{time}</span>
                <span className="text-xs text-slate-500">({group.length})</span>
              </div>
              <div className="space-y-3">
                {group.map((apt) => (
                  <div key={apt.id} className="flex items-start justify-between border border-slate-200 rounded-lg p-3">
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
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${apt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {apt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
