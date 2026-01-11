import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import type { Customer, Vehicle } from '../types/database';

interface AddServiceModalProps {
  customer: Customer;
  onClose: () => void;
}

export function AddServiceModal({ customer, onClose }: AddServiceModalProps) {
  const { customer: admin } = useAuth();
  const { brandSettings } = useBrand();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pointsPerDollar, setPointsPerDollar] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    vehicleId: '',
    serviceDate: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    mileageAtService: '',
    notes: '',
  });

  useEffect(() => {
    loadVehicles();
    loadSettings();
  }, []);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('customer_id', customer.id);

      if (error) throw error;
      setVehicles(data || []);
      if (data && data.length > 0) {
        setFormData((prev) => ({ ...prev, vehicleId: data[0].id }));
      }
    } catch (err) {
      console.error('Error loading vehicles:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('points_per_dollar')
        .eq('shop_id', customer.shop_id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setPointsPerDollar(Number(data.points_per_dollar));
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const tierMultiplier = customer.tier_multiplier || 1.0;
      const pointsEarned = Math.floor(amount * pointsPerDollar * tierMultiplier);

      const { error: insertError } = await supabase.from('services').insert({
        vehicle_id: formData.vehicleId,
        customer_id: customer.id,
        shop_id: customer.shop_id,
        service_type: formData.description || 'General Service',
        description: formData.notes || formData.description,
        service_date: formData.serviceDate,
        amount,
        points_earned: pointsEarned,
      });

      if (insertError) throw insertError;

      if (formData.mileageAtService) {
        const mileage = parseInt(formData.mileageAtService);
        const { error: vehicleUpdateError } = await supabase
          .from('vehicles')
          .update({
            current_mileage: mileage,
            last_service_date: formData.serviceDate,
            last_service_mileage: mileage,
          })
          .eq('id', formData.vehicleId);

        if (vehicleUpdateError) throw vehicleUpdateError;
      }

      onClose();
    } catch (err: unknown) {
      console.error('Error adding service:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Add Service Record</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-slate-600">Customer</p>
            <p className="font-semibold text-slate-900">{customer.full_name}</p>
            <p className="text-sm text-slate-600">{customer.email}</p>
          </div>

          <div>
            <label htmlFor="vehicleId" className="block text-sm font-medium text-slate-700 mb-1">
              Vehicle
            </label>
            <select
              id="vehicleId"
              required
              value={formData.vehicleId}
              onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                  {vehicle.license_plate ? ` - ${vehicle.license_plate}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="serviceDate" className="block text-sm font-medium text-slate-700 mb-1">
              Service Date
            </label>
            <input
              id="serviceDate"
              type="date"
              required
              value={formData.serviceDate}
              onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
              Service Description
            </label>
            <input
              id="description"
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Oil Change, Brake Replacement"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">
              Amount ($)
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="text-sm text-slate-600 mt-1">
              Reward points: {formData.amount ? Math.floor((parseFloat(formData.amount) || 0) * pointsPerDollar * (customer.tier_multiplier || 1.0)) : 0} points
              {customer.tier_multiplier > 1
                ? ` (${pointsPerDollar} pts/$1 × ${customer.tier_multiplier}x tier multiplier)`
                : ` (${pointsPerDollar} pts/$1)`
              }
            </p>
          </div>

          <div>
            <label htmlFor="mileageAtService" className="block text-sm font-medium text-slate-700 mb-1">
              Mileage at Service (Optional)
            </label>
            <input
              id="mileageAtService"
              type="number"
              min="0"
              value={formData.mileageAtService}
              onChange={(e) => setFormData({ ...formData, mileageAtService: e.target.value })}
              placeholder="e.g., 45000"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Any additional notes..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: loading ? '#cbd5e1' : brandSettings.primary_color,
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = brandSettings.secondary_color)}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = brandSettings.primary_color)}
            >
              {loading ? 'Adding...' : 'Add Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
