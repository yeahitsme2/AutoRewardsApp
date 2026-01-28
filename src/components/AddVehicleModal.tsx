import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBrand } from '../lib/BrandContext';
import { useShop } from '../lib/ShopContext';
import type { Customer } from '../types/database';

interface AddVehicleModalProps {
  customer: Customer;
  onClose: () => void;
}

export function AddVehicleModal({ customer, onClose }: AddVehicleModalProps) {
  const { brandSettings } = useBrand();
  const { shop } = useShop();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear().toString(),
    vin: '',
    licensePlate: '',
    color: '',
    mileage: '',
    pictureUrl: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const year = parseInt(formData.year);
      if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) {
        throw new Error('Please enter a valid year');
      }

      if (!shop?.id) {
        throw new Error('Shop information is not available');
      }

      const vehiclePayload: any = {
        customer_id: customer.id,
        make: formData.make,
        model: formData.model,
        year,
        vin: formData.vin || null,
        license_plate: formData.licensePlate || null,
        color: formData.color || null,
        current_mileage: formData.mileage ? parseInt(formData.mileage) : 0,
        picture_url: formData.pictureUrl || null,
      };

      const primaryInsert = await supabase.from('vehicles').insert({
        ...vehiclePayload,
        shop_id: shop.id,
      });

      if (primaryInsert.error) {
        const missingColumn = primaryInsert.error.code === '42703'
          || (typeof primaryInsert.error.message === 'string' && primaryInsert.error.message.includes('does not exist'));
        if (!missingColumn) throw primaryInsert.error;
        const fallbackInsert = await supabase.from('vehicles').insert(vehiclePayload);
        if (fallbackInsert.error) throw fallbackInsert.error;
      }

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Add Vehicle</h2>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="make" className="block text-sm font-medium text-slate-700 mb-1">
                Make
              </label>
              <input
                id="make"
                type="text"
                required
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                placeholder="e.g., Toyota"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="model" className="block text-sm font-medium text-slate-700 mb-1">
                Model
              </label>
              <input
                id="model"
                type="text"
                required
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g., Camry"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-slate-700 mb-1">
                Year
              </label>
              <input
                id="year"
                type="number"
                required
                min="1900"
                max={new Date().getFullYear() + 1}
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="color" className="block text-sm font-medium text-slate-700 mb-1">
                Color (Optional)
              </label>
              <input
                id="color"
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="e.g., Silver"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="licensePlate" className="block text-sm font-medium text-slate-700 mb-1">
              License Plate (Optional)
            </label>
            <input
              id="licensePlate"
              type="text"
              value={formData.licensePlate}
              onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
              placeholder="e.g., ABC-1234"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="vin" className="block text-sm font-medium text-slate-700 mb-1">
              VIN (Optional)
            </label>
            <input
              id="vin"
              type="text"
              value={formData.vin}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
              placeholder="17-character VIN"
              maxLength={17}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="mileage" className="block text-sm font-medium text-slate-700 mb-1">
              Current Mileage (Optional)
            </label>
            <input
              id="mileage"
              type="number"
              min="0"
              value={formData.mileage}
              onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
              placeholder="e.g., 45000"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="pictureUrl" className="block text-sm font-medium text-slate-700 mb-1">
              Vehicle Picture URL (Optional)
            </label>
            <input
              id="pictureUrl"
              type="url"
              value={formData.pictureUrl}
              onChange={(e) => setFormData({ ...formData, pictureUrl: e.target.value })}
              placeholder="https://example.com/car-image.jpg"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {formData.pictureUrl && (
              <div className="mt-2">
                <img
                  src={formData.pictureUrl}
                  alt="Vehicle preview"
                  className="w-full h-32 object-cover rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
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
              {loading ? 'Adding...' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
