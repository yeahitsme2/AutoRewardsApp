import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { useShop } from '../lib/ShopContext';
import { supabase } from '../lib/supabase';
import { Bell, Car, Calendar, Award, LogOut, Wrench, Gift, Tag, Plus, ClipboardList, MessageSquare } from 'lucide-react';
import { CustomerRewards } from './CustomerRewards';
import { CustomerServices } from './CustomerServices';
import { CustomerPromotions } from './CustomerPromotions';
import { CustomerAppointments } from './CustomerAppointments';
import { CustomerRepairOrders } from './CustomerRepairOrders';
import { MessagesCenter } from './MessagesCenter';
import { TierProgress } from './TierProgress';
import { RewardProgress } from './RewardProgress';
import { ServiceReminders } from './ServiceReminders';
import { AddVehicleModal } from './AddVehicleModal';
import { ensurePushSubscription } from '../lib/pushNotifications';
import type { Vehicle, Service, Database } from '../types/database';

interface VehicleWithServices extends Vehicle {
  services: Service[];
}

type TabType = 'vehicles' | 'services' | 'appointments' | 'repair_orders' | 'rewards' | 'offers' | 'messages';
type NotificationItem = Database['public']['Tables']['notifications']['Row'];

export function CustomerDashboard() {
  const { customer, signOut, refreshCustomer } = useAuth();
  const { brandSettings } = useBrand();
  const { shop } = useShop();
  const [activeTab, setActiveTab] = useState<TabType>('vehicles');
  const [vehicles, setVehicles] = useState<VehicleWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadPromoCount, setUnreadPromoCount] = useState(0);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    loadData();
    loadUnreadPromoCount();
    return () => {};
  }, []);

  useEffect(() => {
    if (customer?.shop_id) {
      ensurePushSubscription({ userRole: 'customer', shopId: customer.shop_id });
    }
  }, [customer?.shop_id]);

  useEffect(() => {
    if (activeTab === 'offers') {
      loadUnreadPromoCount();
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
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

      const vehiclesWithServices: VehicleWithServices[] = (vehiclesData || []).map((vehicle) => ({
        ...vehicle,
        services: (servicesData || []).filter((service) => service.vehicle_id === vehicle.id),
      }));

      setVehicles(vehiclesWithServices);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadPromoCount = async () => {
    if (!customer) return;

    try {
      const { count, error } = await supabase
        .from('customer_promotions')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customer.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadPromoCount(count || 0);
    } catch (error) {
      console.error('Error loading unread promo count:', error);
    }
  };

  const loadNotifications = async () => {
    if (!customer) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_role', 'customer')
        .eq('recipient_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = (data || []) as NotificationItem[];
      setNotifications(rows);
      setUnreadNotifications(rows.filter((note) => !note.is_read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  useEffect(() => {
    if (!customer?.id) return;
    const channel = supabase
      .channel(`customer-dashboard-${customer.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vehicles',
        filter: `customer_id=eq.${customer.id}`,
      }, () => {
        loadData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'services',
        filter: `customer_id=eq.${customer.id}`,
      }, () => {
        loadData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'customer_promotions',
        filter: `customer_id=eq.${customer.id}`,
      }, () => {
        loadUnreadPromoCount();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [customer?.id]);

  useEffect(() => {
    if (!customer?.id) return;
    loadNotifications();
    const channel = supabase
      .channel(`customer-notifications-${customer.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${customer.id}`,
      }, () => {
        loadNotifications();
      });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [customer?.id]);

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
        if (tab === 'repair_orders' || tab === 'appointments' || tab === 'messages' || tab === 'offers') {
          setActiveTab(tab as TabType);
        }
      } catch (error) {
        console.warn('Invalid notification URL:', error);
      }
    } else if (note.entity_type === 'repair_order' || note.entity_type === 'dvi_report') {
      setActiveTab('repair_orders');
    } else if (note.entity_type === 'appointment') {
      setActiveTab('appointments');
    } else if (note.entity_type === 'chat') {
      setActiveTab('messages');
    }
    setShowNotifications(false);
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
      <header
        className="shadow-sm border-b border-slate-200"
        style={{
          backgroundImage: `linear-gradient(90deg, ${brandSettings.primary_color}, ${brandSettings.secondary_color})`,
        }}
      >
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
                <h1 className="text-lg sm:text-2xl font-bold text-white truncate">{shop?.name || 'Rewards Dashboard'}</h1>
                <p className="text-xs sm:text-sm text-slate-100 truncate">{brandSettings.welcome_message}, {customer?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications((prev) => !prev)}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20"
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
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-slate-100 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TierProgress customer={customer!} />
          <RewardProgress customer={customer!} />
        </div>

        <div className="mb-8">
          <ServiceReminders vehicles={vehicles.map(v => v)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${brandSettings.primary_color}20` }}
              >
                <Award className="w-6 h-6" style={{ color: brandSettings.primary_color }} />
              </div>
              <div>
                <p className="text-sm text-slate-600">Reward Points</p>
                <p className="text-3xl font-bold text-slate-900">{customer?.reward_points || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Car className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Vehicles</p>
                <p className="text-3xl font-bold text-slate-900">{vehicles.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 border-b border-slate-200 -mx-4 sm:mx-0">
          <div className="flex gap-2 sm:gap-4 overflow-x-auto px-4 sm:px-0 scrollbar-hide">
            <button
              onClick={() => setActiveTab('vehicles')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={activeTab === 'vehicles' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <Car className="w-5 h-5" />
              <span className="text-sm sm:text-base">Vehicles</span>
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={activeTab === 'services' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <Wrench className="w-5 h-5" />
              <span className="text-sm sm:text-base">Services</span>
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={activeTab === 'appointments' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <Calendar className="w-5 h-5" />
              <span className="text-sm sm:text-base">Appointments</span>
            </button>
            <button
              onClick={() => setActiveTab('repair_orders')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={activeTab === 'repair_orders' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <ClipboardList className="w-5 h-5" />
              <span className="text-sm sm:text-base">Repair Orders</span>
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
              onClick={() => setActiveTab('offers')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 relative whitespace-nowrap flex-shrink-0"
              style={activeTab === 'offers' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <Tag className="w-5 h-5" />
              <span className="text-sm sm:text-base">Offers</span>
              {unreadPromoCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadPromoCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={activeTab === 'messages' ? {
                borderBottomColor: brandSettings.primary_color,
                color: brandSettings.primary_color
              } : { borderBottomColor: 'transparent', color: '#475569' }}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-sm sm:text-base">Messages</span>
            </button>
          </div>
        </div>

        {activeTab === 'vehicles' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddVehicleModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-colors"
                style={{ backgroundColor: brandSettings.primary_color }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = brandSettings.secondary_color)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = brandSettings.primary_color)}
              >
                <Plus className="w-5 h-5" />
                Add Vehicle
              </button>
            </div>

          {vehicles.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <Car className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Vehicles Yet</h3>
              <p className="text-slate-600 mb-4">
                Add your vehicles to book appointments and track service history.
              </p>
              <button
                onClick={() => setShowAddVehicleModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 text-white font-medium rounded-lg transition-colors"
                style={{ backgroundColor: brandSettings.primary_color }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = brandSettings.secondary_color)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = brandSettings.primary_color)}
              >
                <Plus className="w-5 h-5" />
                Add Your First Vehicle
              </button>
            </div>
          ) : (
            vehicles.map((vehicle) => (
              <div key={vehicle.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {vehicle.picture_url && (
                  <div className="w-full h-48 overflow-hidden">
                    <img
                      src={vehicle.picture_url}
                      alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Car className="w-5 h-5 text-slate-600" />
                      <h3 className="text-lg font-semibold text-slate-900">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h3>
                    </div>
                    <span className="text-sm text-slate-600">
                      {vehicle.current_mileage?.toLocaleString() || '0'} miles
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 mt-1 space-y-0.5">
                    {vehicle.color && <p>Color: {vehicle.color}</p>}
                    {vehicle.license_plate && <p>License Plate: {vehicle.license_plate}</p>}
                    {vehicle.vin && <p>VIN: {vehicle.vin}</p>}
                  </div>
                </div>

                <div className="p-6">
                  <h4 className="font-semibold text-slate-900 mb-4">Service History</h4>
                  {vehicle.services.length === 0 ? (
                    <p className="text-slate-600 text-sm">No service history yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {vehicle.services.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-start justify-between p-4 bg-slate-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="w-4 h-4 text-slate-500" />
                              <span className="text-sm text-slate-600">
                                {new Date(service.service_date).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="font-medium text-slate-900 mb-1">{service.description}</p>
                            {service.notes && (
                              <p className="text-sm text-slate-600">{service.notes}</p>
                            )}
                            {service.mileage_at_service && (
                              <p className="text-xs text-slate-500 mt-1">
                                Mileage: {service.mileage_at_service.toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-bold text-slate-900">${Number(service.amount).toFixed(2)}</p>
                            <p className="text-sm" style={{ color: brandSettings.primary_color }}>+{service.points_earned} pts</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          </div>
        )}

        {activeTab === 'services' && <CustomerServices />}

        {activeTab === 'appointments' && <CustomerAppointments />}

        {activeTab === 'repair_orders' && <CustomerRepairOrders />}

        {activeTab === 'rewards' && <CustomerRewards />}

        {activeTab === 'offers' && <CustomerPromotions />}

        {activeTab === 'messages' && <MessagesCenter mode="customer" />}
      </main>

      {showAddVehicleModal && customer && (
        <AddVehicleModal
          customer={customer}
          onClose={() => {
            setShowAddVehicleModal(false);
            loadData();
          }}
        />
      )}

      <footer className="py-6 text-center text-xs text-slate-500">
        <a href="/legal.html" className="hover:text-slate-700">Legal</a>
        <span className="mx-2">•</span>
        <span>Copyright (c) 2026 DriveRewards. All rights reserved.</span>
      </footer>
    </div>
  );
}
