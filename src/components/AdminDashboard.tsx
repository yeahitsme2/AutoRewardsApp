import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { supabase } from '../lib/supabase';
import { Bell, LogOut, Wrench, Users, UserCheck, UserX, Search, Gift, Crown, Settings as SettingsIcon, Tag, Calendar, TrendingUp, X, Car, Award, ClipboardList, Clock, Briefcase, ClipboardCheck, Boxes, MessageSquare } from 'lucide-react';
import { AddServiceModal } from './AddServiceModal';
import { AddVehicleModal } from './AddVehicleModal';
import { RewardsManagement } from './RewardsManagement';
import { PromotionsManagement } from './PromotionsManagement';
import { AppointmentsManagement } from './AppointmentsManagement';
import { RepairOrdersManagement } from './RepairOrdersManagement';
import { ScheduleBoard } from './ScheduleBoard';
import { DviManagement } from './DviManagement';
import { InventoryManagement } from './InventoryManagement';
import { MessagesCenter } from './MessagesCenter';
import { Settings } from './Settings';
import { UserManagement } from './UserManagement';
import { Insights } from './Insights';
import { getTierInfo, calculateSpendingToNextTier } from '../lib/rewardsUtils';
import { ensurePushSubscription } from '../lib/pushNotifications';
import type { Customer, Vehicle, Service, Database } from '../types/database';

interface CustomerWithVehicles extends Customer {
  vehicles: Vehicle[];
  services: Service[];
}

type TabType = 'customers' | 'appointments' | 'my_shop' | 'rewards' | 'promotions' | 'users' | 'settings';
type MyShopTab = 'schedule' | 'repair_orders' | 'inspections' | 'inventory' | 'messages' | 'insights';
type NotificationItem = Database['public']['Tables']['notifications']['Row'];

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const pendingCountRef = useRef(0);

  const getLifetimeSpending = (customer: Customer) =>
    (customer as any).lifetime_spending ??
    (customer as any).total_lifetime_spending ??
    (customer as any).total_spent ??
    0;

  const loadData = useCallback(async () => {
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
  }, []);

  const loadPendingAppointments = useCallback(async () => {
    if (!admin?.shop_id) return;
    try {
      const { count, error } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', admin.shop_id)
        .eq('status', 'pending');

      if (error) throw error;

      const newCount = count || 0;
      if (newCount > pendingCountRef.current && pendingCountRef.current > 0) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('New Appointment Request', {
            body: 'A customer has requested a new appointment',
            icon: '/favicon.ico',
          });
        }
      }

      pendingCountRef.current = newCount;
      setPendingAppointments(newCount);
    } catch (error) {
      console.error('Error loading pending appointments:', error);
    }
  }, [admin?.shop_id]);

  const loadNotifications = useCallback(async () => {
    if (!admin?.shop_id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_role', 'admin')
        .eq('shop_id', admin.shop_id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = (data || []) as NotificationItem[];
      const deduped = Array.from(new Map(rows.map((item) => [item.id, item])).values());
      setNotifications(deduped);
      setUnreadNotifications(deduped.filter((item) => !item.is_read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [admin?.shop_id]);

  useEffect(() => {
    loadData();
    loadPendingAppointments();

    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    return () => {};
  }, [loadData, loadPendingAppointments]);

  useEffect(() => {
    if (!admin?.shop_id) return;
    loadNotifications();
    const channel = supabase
      .channel(`admin-notifications-${admin.shop_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `shop_id=eq.${admin.shop_id}`,
      }, () => {
        loadNotifications();
      });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [admin?.shop_id, loadNotifications]);

  useEffect(() => {
    if (admin?.shop_id) {
      ensurePushSubscription({ userRole: 'admin', shopId: admin.shop_id });
    }
  }, [admin?.shop_id]);

  useEffect(() => {
    if (!showNotifications) return;
    markAllNotificationsRead();
  }, [showNotifications]);

  const markNotificationRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);
      setNotifications((prev) =>
        prev.map((note) => (note.id === notificationId ? { ...note, is_read: true, read_at: new Date().toISOString() } : note))
      );
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    const unreadIds = notifications.filter((note) => !note.is_read).map((note) => note.id);
    if (unreadIds.length === 0) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);
      setNotifications((prev) => prev.map((note) => ({ ...note, is_read: true, read_at: new Date().toISOString() })));
      setUnreadNotifications(0);
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    }
  };

  const handleNotificationOpen = async (note: NotificationItem) => {
    if (!note.is_read) {
      await markNotificationRead(note.id);
    }
    if (note.action_url) {
      try {
        const url = new URL(note.action_url, window.location.origin);
        const tab = url.searchParams.get('tab');
        const sub = url.searchParams.get('sub');
        if (tab === 'appointments' || tab === 'customers' || tab === 'rewards' || tab === 'promotions' || tab === 'settings') {
          setActiveTab(tab);
        } else if (tab === 'my_shop') {
          setActiveTab('my_shop');
          if (sub === 'schedule' || sub === 'repair_orders' || sub === 'inspections' || sub === 'inventory' || sub === 'messages' || sub === 'insights') {
            setMyShopTab(sub);
          }
        }
      } catch (error) {
        console.warn('Invalid notification URL:', error);
      }
    } else if (note.entity_type === 'repair_order') {
      setActiveTab('my_shop');
      setMyShopTab('repair_orders');
    } else if (note.entity_type === 'appointment') {
      setActiveTab('appointments');
    } else if (note.entity_type === 'chat') {
      setActiveTab('my_shop');
      setMyShopTab('messages');
    }
    setShowNotifications(false);
  };

  useEffect(() => {
    if (!admin?.shop_id) return;

    const channel = supabase
      .channel(`admin-repair-orders-${admin.shop_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'repair_orders',
        filter: `shop_id=eq.${admin.shop_id}`,
      }, () => {
        loadData();
        loadPendingAppointments();
      });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [admin?.shop_id, loadData, loadPendingAppointments]);

  useEffect(() => {
    if (!admin?.shop_id) return;
    const channel = supabase
      .channel(`admin-appointments-${admin.shop_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `shop_id=eq.${admin.shop_id}`,
      }, () => {
        loadPendingAppointments();
      });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [admin?.shop_id, loadPendingAppointments]);

  useEffect(() => {
    const handler = () => loadPendingAppointments();
    window.addEventListener('appointments:refresh', handler);
    return () => {
      window.removeEventListener('appointments:refresh', handler);
    };
  }, [loadPendingAppointments]);

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
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications((prev) => !prev)}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 text-slate-200 hover:text-white"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadNotifications}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-80 max-h-96 overflow-auto rounded-xl border border-slate-200 bg-white text-slate-900 shadow-lg z-50">
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                      <div className="text-sm font-semibold">Notifications</div>
                      <button
                        onClick={markAllNotificationsRead}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Mark all read
                      </button>
                    </div>
                    {notifications.length === 0 && (
                      <div className="p-4 text-sm text-slate-500">No notifications yet.</div>
                    )}
                    {notifications.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => handleNotificationOpen(note)}
                        className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                          note.is_read ? 'bg-white' : 'bg-slate-50'
                        }`}
                      >
                        <div className="text-sm font-semibold text-slate-900">{note.title}</div>
                        {note.body && <div className="text-xs text-slate-500 mt-1">{note.body}</div>}
                        <div className="text-[11px] text-slate-400 mt-1">
                          {new Date(note.created_at).toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
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
              {unreadNotifications > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
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
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">Customers ({customers.length})</h2>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, phone..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setDateFilter('');
                      if (e.target.value) setShowAllCustomers(true);
                    }}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
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
                    className="w-full sm:w-44 pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                  />
                </div>

                {(searchQuery || dateFilter) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setDateFilter('');
                      setShowAllCustomers(false);
                    }}
                    className="px-3 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  {searchQuery ? `${filteredCustomers.length} result${filteredCustomers.length !== 1 ? 's' : ''}` : dateFilter ? `${filteredCustomers.length} customer${filteredCustomers.length !== 1 ? 's' : ''}` : showAllCustomers ? `All ${customers.length} customers` : `Last 10 customers`}
                </span>
                {!searchQuery && !dateFilter && (
                  <button
                    onClick={() => setShowAllCustomers(!showAllCustomers)}
                    className="text-xs font-medium transition-colors"
                    style={{ color: brandSettings.primary_color }}
                  >
                    {showAllCustomers ? 'Show Last 10' : `Show All`}
                  </button>
                )}
              </div>
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
            <p className="text-slate-600">No customers match your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((cust) => (
              <div key={cust.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-lg font-semibold text-slate-900">{cust.full_name}</h3>
                        {(() => {
                          const tierInfo = getTierInfo(cust.tier, brandSettings);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r ${tierInfo.gradient} text-white text-xs font-medium rounded-full`}>
                              <Crown className="w-3 h-3" />
                              {tierInfo.displayName}
                            </span>
                          );
                        })()}
                        {cust.has_account && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
                            style={{
                              backgroundColor: `${brandSettings.primary_color}20`,
                              color: brandSettings.primary_color
                            }}
                          >
                            <UserCheck className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 space-y-0.5">
                        <p>{cust.email}</p>
                        {cust.phone && <p>{cust.phone}</p>}
                        {((cust as any).address_line1 || (cust as any).city || (cust as any).state || (cust as any).postal_code || (cust as any).country) && (
                          <div className="mt-1 pt-1 border-t border-slate-100">
                            {(cust as any).address_line1 && <p>{(cust as any).address_line1}</p>}
                            {(cust as any).address_line2 && <p>{(cust as any).address_line2}</p>}
                            {((cust as any).city || (cust as any).state || (cust as any).postal_code) && (
                              <p>
                                {[(cust as any).city, (cust as any).state, (cust as any).postal_code].filter(Boolean).join(', ')}
                              </p>
                            )}
                            {(cust as any).country && <p>{(cust as any).country}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="font-semibold text-slate-900">{cust.reward_points} pts</p>
                      <p className="text-xs text-slate-500">${Number(getLifetimeSpending(cust)).toFixed(2)} lifetime</p>
                    </div>
                  </div>

                  {cust.vehicles.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-slate-600">Vehicles ({cust.vehicles.length})</p>
                        <button
                          onClick={() => handleAddVehicle(cust)}
                          className="text-xs font-medium transition-colors"
                          style={{ color: brandSettings.primary_color }}
                        >
                          + Add
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {cust.vehicles.slice(0, 3).map((vehicle) => (
                          <div key={vehicle.id} className="bg-slate-50 rounded border border-slate-200 overflow-hidden text-xs">
                            {vehicle.picture_url && (
                              <img
                                src={vehicle.picture_url}
                                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                className="w-full h-16 object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <div className="p-2">
                              <p className="font-medium text-slate-900 line-clamp-1">
                                {vehicle.year} {vehicle.make}
                              </p>
                              {vehicle.license_plate && <p className="text-slate-600">{vehicle.license_plate}</p>}
                            </div>
                          </div>
                        ))}
                        {cust.vehicles.length > 3 && (
                          <div className="bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                            +{cust.vehicles.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {cust.services.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-600 mb-2">Last {Math.min(cust.services.length, 2)} services</p>
                      <div className="space-y-1">
                        {cust.services.slice(0, 2).map((service) => (
                          <div key={service.id} className="flex items-center justify-between text-xs bg-slate-50 rounded p-2">
                            <div>
                              <p className="font-medium text-slate-900">{service.service_type}</p>
                              <p className="text-slate-500">{new Date(service.service_date).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-slate-900">${Number(service.amount).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => handleAddService(cust)}
                    disabled={cust.vehicles.length === 0}
                    className="w-full mt-3 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: cust.vehicles.length === 0 ? '#cbd5e1' : brandSettings.primary_color
                    }}
                    onMouseEnter={(e) => cust.vehicles.length > 0 && (e.currentTarget.style.backgroundColor = brandSettings.secondary_color)}
                    onMouseLeave={(e) => cust.vehicles.length > 0 && (e.currentTarget.style.backgroundColor = brandSettings.primary_color)}
                  >
                    Add Service
                  </button>
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
              {(['schedule', 'repair_orders', 'inspections', 'inventory', 'messages', 'insights'] as const).map((tab) => (
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
                  {tab === 'inspections' && <ClipboardCheck className="w-4 h-4" />}
                  {tab === 'inventory' && <Boxes className="w-4 h-4" />}
                  {tab === 'messages' && <MessageSquare className="w-4 h-4" />}
                  {tab === 'insights' && <TrendingUp className="w-4 h-4" />}
                  {tab === 'schedule'
                    ? 'Schedule'
                    : tab === 'repair_orders'
                      ? 'Repair Orders'
                      : tab === 'inspections'
                        ? 'DVI'
                        : tab === 'inventory'
                          ? 'Inventory'
                          : tab === 'messages'
                            ? 'Messages'
                            : 'Insights'}
                </button>
              ))}
            </div>

            {myShopTab === 'schedule' && <ScheduleBoard />}
            {myShopTab === 'repair_orders' && <RepairOrdersManagement />}
            {myShopTab === 'inspections' && <DviManagement />}
            {myShopTab === 'inventory' && <InventoryManagement />}
            {myShopTab === 'messages' && <MessagesCenter mode="admin" />}
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
