import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { supabase } from '../lib/supabase';
import { LogOut, Wrench, Users, UserCheck, UserX, Search, Gift, Crown, Settings as SettingsIcon, Tag, Calendar, TrendingUp, X, Car, Award, ClipboardList, Clock, Briefcase } from 'lucide-react';
import { AddServiceModal } from './AddServiceModal';
import { AddVehicleModal } from './AddVehicleModal';
import { RewardsManagement } from './RewardsManagement';
import { PromotionsManagement } from './PromotionsManagement';
import { AppointmentsManagement } from './AppointmentsManagement';
import { RepairOrdersManagement } from './RepairOrdersManagement';
import { ScheduleBoard } from './ScheduleBoard';
import { Settings } from './Settings';
import { UserManagement } from './UserManagement';
import { Insights } from './Insights';
import { getTierInfo, calculateSpendingToNextTier } from '../lib/rewardsUtils';
import { ensurePushSubscription } from '../lib/pushNotifications';
import type { Customer, Vehicle, Service } from '../types/database';

interface CustomerWithVehicles extends Customer {
  vehicles: Vehicle[];
  services: Service[];
}

type TabType = 'customers' | 'appointments' | 'my_shop' | 'rewards' | 'promotions' | 'users' | 'settings';
type MyShopTab = 'schedule' | 'repair_orders' | 'insights';

export function AdminDashboard() {
  const { admin, signOut } = useAuth();
  const { brandSettings } = useBrand();
  const [activeTab, setActiveTab] = useState<TabType>('customers');
  const [myShopTab, setMyShopTab] = useState<MyShopTab>('schedule');
  const [customers, setCustomers] = useState<CustomerWithVehicles[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerWithVehicles[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pendingAppointments, setPendingAppointments] = useState(0);

  const getLifetimeSpending = (customer: Customer) =>
    (customer as any).lifetime_spending ??
    (customer as any).total_lifetime_spending ??
    (customer as any).total_spent ??
    0;

  useEffect(() => {
    loadData();
    loadPendingAppointments();

    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const interval = setInterval(() => {
      loadPendingAppointments();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (admin?.shop_id) {
      ensurePushSubscription({ userRole: 'admin', shopId: admin.shop_id });
    }
  }, [admin?.shop_id]);

  useEffect(() => {
    let filtered = customers;

    if (dateFilter) {
      filtered = filtered.filter((cust) => {
        const createdDate = new Date(cust.created_at).toISOString().split('T')[0];
        return createdDate === dateFilter;
      });
      setFilteredCustomers(filtered);
      return;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((cust) => {
        const fullName = cust.full_name?.toLowerCase() || '';
        const email = cust.email?.toLowerCase() || '';
        const phone = cust.phone?.toLowerCase() || '';
        return fullName.includes(query) || email.includes(query) || phone.includes(query);
      });
      setFilteredCustomers(filtered);
      return;
    }

    if (!showAllCustomers) {
      filtered = filtered.slice(0, 10);
    }

    setFilteredCustomers(filtered);
  }, [searchQuery, dateFilter, showAllCustomers, customers]);

  const loadData = async () => {
    try {
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (customersError) throw customersError;

      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (vehiclesError) throw vehiclesError;

      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .order('service_date', { ascending: false });

      if (servicesError) throw servicesError;

      const customersWithVehicles: CustomerWithVehicles[] = (customersData || []).map((customer) => ({
        ...customer,
        vehicles: (vehiclesData || []).filter((vehicle) => vehicle.customer_id === customer.id),
        services: (servicesData || []).filter((service) => service.customer_id === customer.id),
      }));

      setCustomers(customersWithVehicles);
      setFilteredCustomers(customersWithVehicles);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingAppointments = async () => {
    try {
      const { count, error } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;

      const newCount = count || 0;
      if (newCount > pendingAppointments && pendingAppointments > 0) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('New Appointment Request', {
            body: 'A customer has requested a new appointment',
            icon: '/favicon.ico',
          });
        }
      }

      setPendingAppointments(newCount);
    } catch (error) {
      console.error('Error loading pending appointments:', error);
    }
  };

  const handleAddService = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowAddService(true);
  };

  const handleAddVehicle = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowAddVehicle(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: brandSettings.logo_url ? 'transparent' : brandSettings.primary_color }}
              >
                {brandSettings.logo_url ? (
                  <img
                    src={brandSettings.logo_url}
                    alt="Shop logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.style.backgroundColor = brandSettings.primary_color;
                      target.parentElement!.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;
                    }}
                  />
                ) : (
                  <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold truncate">Admin Dashboard</h1>
                <p className="text-xs sm:text-sm text-slate-300 truncate">{admin?.full_name}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-slate-300 hover:text-white transition-colors flex-shrink-0"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 border-b border-slate-200 -mx-4 sm:mx-0">
          <div className="flex gap-2 sm:gap-4 overflow-x-auto px-4 sm:px-0 scrollbar-hide">
            <button
              onClick={() => setActiveTab('customers')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={activeTab === 'customers' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <Users className="w-5 h-5" />
              <span className="text-sm sm:text-base">Customers</span>
              <span className="hidden sm:inline text-sm bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {customers.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 relative whitespace-nowrap flex-shrink-0"
              style={activeTab === 'appointments' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <Calendar className="w-5 h-5" />
              <span className="text-sm sm:text-base">Appointments</span>
              {pendingAppointments > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingAppointments}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('my_shop')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={activeTab === 'my_shop' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <Briefcase className="w-5 h-5" />
              <span className="text-sm sm:text-base">My Shop</span>
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={activeTab === 'rewards' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <Gift className="w-5 h-5" />
              <span className="text-sm sm:text-base">Rewards</span>
            </button>
            <button
              onClick={() => setActiveTab('promotions')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={activeTab === 'promotions' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <Tag className="w-5 h-5" />
              <span className="text-sm sm:text-base">Promotions</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={activeTab === 'users' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <UserCheck className="w-5 h-5" />
              <span className="text-sm sm:text-base">Users</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={activeTab === 'settings' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="text-sm sm:text-base">Settings</span>
            </button>
          </div>
        </div>

        {activeTab === 'customers' && (
          <>
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-6 h-6 text-slate-700" />
                  <h2 className="text-2xl font-bold text-slate-900">Customers</h2>
                  <span className="text-slate-500 text-lg">({customers.length})</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setDateFilter('');
                      if (e.target.value) setShowAllCustomers(true);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value);
                      setSearchQuery('');
                      if (e.target.value) setShowAllCustomers(true);
                    }}
                    className="w-full sm:w-48 pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>

                {(searchQuery || dateFilter) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setDateFilter('');
                      setShowAllCustomers(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                )}
              </div>

              {!searchQuery && !dateFilter && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    {showAllCustomers ? `Showing all ${customers.length} customers` : `Showing last 10 customers`}
                  </p>
                  <button
                    onClick={() => setShowAllCustomers(!showAllCustomers)}
                    className="text-sm font-medium transition-colors"
                    style={{ color: brandSettings.primary_color }}
                  >
                    {showAllCustomers ? 'Show Last 10' : `Show All (${customers.length})`}
                  </button>
                </div>
              )}

              {dateFilter && (
                <p className="text-sm text-slate-600">
                  Showing {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} from {new Date(dateFilter + 'T00:00:00').toLocaleDateString()}
                </p>
              )}

              {searchQuery && (
                <p className="text-sm text-slate-600">
                  Found {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} matching "{searchQuery}"
                </p>
              )}
            </div>

        {customers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Customers Yet</h3>
            <p className="text-slate-600">Customers will appear here once they sign up.</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Results Found</h3>
            <p className="text-slate-600">No customers match your search for "{searchQuery}"</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCustomers.map((cust) => (
              <div key={cust.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-semibold text-slate-900">{cust.full_name}</h3>
                        {(() => {
                          const tierInfo = getTierInfo(cust.tier, brandSettings);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r ${tierInfo.gradient} text-white text-xs font-medium rounded-full`}>
                              <Crown className="w-3 h-3" />
                              {tierInfo.displayName}
                            </span>
                          );
                        })()}
                        {cust.has_account ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full"
                            style={{
                              backgroundColor: `${brandSettings.primary_color}20`,
                              color: brandSettings.primary_color
                            }}
                          >
                            <UserCheck className="w-3 h-3" />
                            Has Account
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                            <UserX className="w-3 h-3" />
                            Walk-in
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600">{cust.email}</p>
                      {cust.phone && <p className="text-slate-600">{cust.phone}</p>}
                    </div>
                    <div className="text-right space-y-3">
                      <div>
                        <p className="text-sm text-slate-600">Reward Points</p>
                        <p className="text-2xl font-bold" style={{ color: brandSettings.primary_color }}>
                          {cust.reward_points} points
                        </p>
                        <p className="text-xs text-slate-500">{getTierInfo(cust.tier, brandSettings).multiplier}x multiplier</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Lifetime Spending</p>
                        <p className="text-xl font-semibold text-slate-900">
                          ${Number(getLifetimeSpending(cust)).toFixed(2)}
                        </p>
                      </div>
                      {(() => {
                        const tierProgress = calculateSpendingToNextTier(cust, brandSettings);
                        if (tierProgress.nextTier) {
                          return (
                            <div className="bg-slate-50 rounded-lg p-2">
                              <p className="text-xs text-slate-600">To reach {tierProgress.nextTier.displayName}</p>
                              <p className="text-sm font-semibold text-slate-900">
                                Spend ${tierProgress.cashNeeded.toFixed(2)} more
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-slate-900">Vehicles ({cust.vehicles.length})</h4>
                      <button
                        onClick={() => handleAddVehicle(cust)}
                        className="text-sm font-medium transition-colors"
                        style={{ color: brandSettings.primary_color }}
                        onMouseEnter={(e) => e.currentTarget.style.color = brandSettings.secondary_color}
                        onMouseLeave={(e) => e.currentTarget.style.color = brandSettings.primary_color}
                      >
                        + Add Vehicle
                      </button>
                    </div>

                    {cust.vehicles.length === 0 ? (
                      <p className="text-slate-600 text-sm">No vehicles registered yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cust.vehicles.map((vehicle) => (
                          <div key={vehicle.id} className="bg-slate-50 rounded-lg overflow-hidden">
                            {vehicle.picture_url && (
                              <img
                                src={vehicle.picture_url}
                                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <div className="p-3">
                              <p className="font-medium text-slate-900">
                                {vehicle.year} {vehicle.make} {vehicle.model}
                              </p>
                              <div className="text-sm text-slate-600 mt-1 space-y-1">
                                {vehicle.color && <p>Color: {vehicle.color}</p>}
                                {vehicle.license_plate && <p>Plate: {vehicle.license_plate}</p>}
                                {vehicle.vin && <p>VIN: {vehicle.vin}</p>}
                                {vehicle.current_mileage && <p>Mileage: {vehicle.current_mileage.toLocaleString()}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-slate-900">Service History ({cust.services.length})</h4>
                    </div>

                    {cust.services.length === 0 ? (
                      <p className="text-slate-600 text-sm">No service records yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {cust.services.slice(0, 5).map((service) => {
                          const vehicle = cust.vehicles.find(v => v.id === service.vehicle_id);
                          return (
                            <div key={service.id} className="bg-slate-50 rounded-lg p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Wrench className="w-4 h-4 text-slate-600" />
                                    <p className="font-medium text-slate-900">{service.service_type}</p>
                                  </div>
                                  {service.description && (
                                    <p className="text-sm text-slate-600 ml-6">{service.description}</p>
                                  )}
                                  {vehicle && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 ml-6">
                                      <Car className="w-3 h-3" />
                                      {vehicle.year} {vehicle.make} {vehicle.model}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 ml-6">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(service.service_date).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-slate-900">${Number(service.amount).toFixed(2)}</p>
                                  <div className="flex items-center gap-1 text-xs mt-1" style={{ color: brandSettings.primary_color }}>
                                    <Award className="w-3 h-3" />
                                    +{service.points_earned} pts
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {cust.services.length > 5 && (
                          <p className="text-xs text-slate-500 text-center">
                            Showing 5 of {cust.services.length} services
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 pt-4 mt-4">
                    <button
                      onClick={() => handleAddService(cust)}
                      disabled={cust.vehicles.length === 0}
                      className="w-full text-white font-medium py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: cust.vehicles.length === 0 ? '#cbd5e1' : brandSettings.primary_color
                      }}
                      onMouseEnter={(e) => cust.vehicles.length > 0 && (e.currentTarget.style.backgroundColor = brandSettings.secondary_color)}
                      onMouseLeave={(e) => cust.vehicles.length > 0 && (e.currentTarget.style.backgroundColor = brandSettings.primary_color)}
                    >
                      {cust.vehicles.length === 0 ? 'Add a vehicle first' : 'Add Service Record'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        )}

        {activeTab === 'appointments' && <AppointmentsManagement />}

        {activeTab === 'my_shop' && (
          <div className="space-y-6">
            <div className="flex gap-2 flex-wrap">
              {(['schedule', 'repair_orders', 'insights'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMyShopTab(tab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    myShopTab === tab
                      ? 'text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                  style={myShopTab === tab ? { backgroundColor: brandSettings.primary_color } : undefined}
                >
                  {tab === 'schedule' && <Clock className="w-4 h-4" />}
                  {tab === 'repair_orders' && <ClipboardList className="w-4 h-4" />}
                  {tab === 'insights' && <TrendingUp className="w-4 h-4" />}
                  {tab === 'schedule' ? 'Schedule' : tab === 'repair_orders' ? 'Repair Orders' : 'Insights'}
                </button>
              ))}
            </div>

            {myShopTab === 'schedule' && <ScheduleBoard />}
            {myShopTab === 'repair_orders' && <RepairOrdersManagement />}
            {myShopTab === 'insights' && <Insights />}
          </div>
        )}

        {activeTab === 'rewards' && <RewardsManagement />}

        {activeTab === 'promotions' && <PromotionsManagement />}

        {activeTab === 'users' && <UserManagement />}

        {activeTab === 'settings' && <Settings />}
      </main>

      {showAddService && selectedCustomer && (
        <AddServiceModal
          customer={selectedCustomer}
          onClose={() => {
            setShowAddService(false);
            setSelectedCustomer(null);
            loadData();
          }}
        />
      )}

      {showAddVehicle && selectedCustomer && (
        <AddVehicleModal
          customer={selectedCustomer}
          onClose={() => {
            setShowAddVehicle(false);
            setSelectedCustomer(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
