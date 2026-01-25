import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { useShop } from '../lib/ShopContext';
import { supabase } from '../lib/supabase';
import { Car, Calendar, Award, LogOut, Wrench, Gift, Tag, Plus, ClipboardList } from 'lucide-react';
import { CustomerRewards } from './CustomerRewards';
import { CustomerServices } from './CustomerServices';
import { CustomerPromotions } from './CustomerPromotions';
import { CustomerAppointments } from './CustomerAppointments';
import { CustomerRepairOrders } from './CustomerRepairOrders';
import { TierProgress } from './TierProgress';
import { RewardProgress } from './RewardProgress';
import { ServiceReminders } from './ServiceReminders';
import { AddVehicleModal } from './AddVehicleModal';
import type { Vehicle, Service } from '../types/database';

interface VehicleWithServices extends Vehicle {
  services: Service[];
}

type TabType = 'vehicles' | 'services' | 'appointments' | 'repair_orders' | 'rewards' | 'offers';

export function CustomerDashboard() {
  const { customer, signOut, refreshCustomer } = useAuth();
  const { brandSettings } = useBrand();
  const { shop } = useShop();
  const [activeTab, setActiveTab] = useState<TabType>('vehicles');
  const [vehicles, setVehicles] = useState<VehicleWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadPromoCount, setUnreadPromoCount] = useState(0);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);

  useEffect(() => {
    loadData();
    loadUnreadPromoCount();

    const interval = setInterval(() => {
      loadData();
      refreshCustomer();
      loadUnreadPromoCount();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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
            <button
              onClick={signOut}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-slate-100 hover:text-white transition-colors flex-shrink-0"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
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
