import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Award, Car, Wrench } from 'lucide-react';
import type { Service, Vehicle } from '../types/database';

interface ServiceWithVehicle extends Service {
  vehicle: Vehicle;
}

export function CustomerServices() {
  const [services, setServices] = useState<ServiceWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();

    const interval = setInterval(() => {
      loadServices();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadServices = async () => {
    try {
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*, vehicle:vehicles(*)')
        .order('service_date', { ascending: false });

      if (servicesError) throw servicesError;

      setServices(servicesData as ServiceWithVehicle[] || []);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading services...</div>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Service History</h3>
        <p className="text-slate-600">Your service history will appear here once you've had work done at our shop.</p>
      </div>
    );
  }

  const totalPoints = services.reduce((sum, service) => sum + service.points_earned, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wrench className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Services</p>
              <p className="text-2xl font-bold text-slate-900">{services.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Points Earned</p>
              <p className="text-2xl font-bold text-slate-900">{totalPoints}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Service History</h3>
        </div>
        <div className="divide-y divide-slate-200">
          {services.map((service) => (
            <div key={service.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {new Date(service.service_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-2">{service.description}</h4>

                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <Car className="w-4 h-4" />
                    <span className="text-sm">
                      {service.vehicle.year} {service.vehicle.make} {service.vehicle.model}
                      {service.vehicle.license_plate && ` - ${service.vehicle.license_plate}`}
                    </span>
                  </div>

                  {service.mileage_at_service && (
                    <p className="text-sm text-slate-600 mb-2">
                      Mileage at service: {service.mileage_at_service.toLocaleString()} miles
                    </p>
                  )}

                  {service.notes && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-700">{service.notes}</p>
                    </div>
                  )}
                </div>

                <div className="text-right ml-6">
                  <p className="text-2xl font-bold text-slate-900 mb-1">
                    ${Number(service.amount).toFixed(2)}
                  </p>
                  <div className="flex items-center gap-1.5 justify-end text-emerald-600">
                    <Award className="w-4 h-4" />
                    <span className="text-sm font-semibold">+{service.points_earned} pts</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
