import { Search, Filter, X } from 'lucide-react';
import type { AppointmentType, ShopLocation } from '../../types/database';

interface AppointmentFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedLocation: string;
  onLocationChange: (locationId: string) => void;
  selectedAppointmentType: string;
  onAppointmentTypeChange: (typeId: string) => void;
  dateFrom: string;
  onDateFromChange: (date: string) => void;
  dateTo: string;
  onDateToChange: (date: string) => void;
  locations: ShopLocation[];
  appointmentTypes: AppointmentType[];
  onClearFilters: () => void;
  brandColor: string;
}

export function AppointmentFilters({
  searchQuery,
  onSearchChange,
  selectedLocation,
  onLocationChange,
  selectedAppointmentType,
  onAppointmentTypeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  locations,
  appointmentTypes,
  onClearFilters,
  brandColor,
}: AppointmentFiltersProps) {
  const hasActiveFilters = searchQuery || selectedLocation || selectedAppointmentType || dateFrom || dateTo;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-slate-600" />
        <h3 className="font-semibold text-slate-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="ml-auto flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by customer, vehicle, or service..."
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {locations.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => onLocationChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {appointmentTypes.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Type
            </label>
            <select
              value={selectedAppointmentType}
              onChange={(e) => onAppointmentTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none"
            >
              <option value="">All Types</option>
              {appointmentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            From Date
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            To Date
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none"
          />
        </div>
      </div>
    </div>
  );
}
