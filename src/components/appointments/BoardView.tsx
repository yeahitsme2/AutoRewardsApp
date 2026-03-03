import { useState } from 'react';
import { Clock, User, Car, Calendar, MapPin } from 'lucide-react';
import type { Appointment, Customer, Vehicle, ShopLocation } from '../../types/database';

interface AppointmentWithDetails extends Appointment {
  customer?: Customer;
  vehicle?: Vehicle;
}

interface BoardViewProps {
  appointments: AppointmentWithDetails[];
  locations: ShopLocation[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  onStatusChange: (appointmentId: string, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed') => void;
  brandColor: string;
}

export function BoardView({ appointments, locations, onAppointmentClick, onStatusChange, brandColor }: BoardViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const columns: { status: 'pending' | 'confirmed' | 'completed' | 'cancelled'; title: string; color: string }[] = [
    { status: 'pending', title: 'Pending', color: '#f59e0b' },
    { status: 'confirmed', title: 'Confirmed', color: brandColor },
    { status: 'completed', title: 'Completed', color: '#3b82f6' },
    { status: 'cancelled', title: 'Cancelled', color: '#ef4444' },
  ];

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDragStart = (appointmentId: string) => {
    setDraggedId(appointmentId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (status: 'pending' | 'confirmed' | 'cancelled' | 'completed') => {
    if (draggedId) {
      onStatusChange(draggedId, status);
      setDraggedId(null);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {columns.map((column) => {
        const columnAppointments = appointments.filter((apt) => apt.status === column.status);

        return (
          <div
            key={column.status}
            className="bg-slate-50 rounded-xl p-4 min-h-[600px]"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.status)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">{column.title}</h3>
              <span
                className="px-2 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: column.color }}
              >
                {columnAppointments.length}
              </span>
            </div>

            <div className="space-y-3">
              {columnAppointments
                .sort((a, b) => {
                  const dateCompare = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
                  if (dateCompare !== 0) return dateCompare;
                  return (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
                })
                .map((appointment) => (
                  <div
                    key={appointment.id}
                    draggable
                    onDragStart={() => handleDragStart(appointment.id)}
                    onClick={() => onAppointmentClick(appointment)}
                    className="bg-white rounded-lg border-2 p-3 cursor-move hover:shadow-lg transition-all"
                    style={{
                      borderColor: draggedId === appointment.id ? column.color : '#e2e8f0',
                      opacity: draggedId === appointment.id ? 0.5 : 1,
                    }}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-slate-900 text-sm">{appointment.service_type}</h4>
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: column.color }}
                        />
                      </div>

                      {appointment.customer && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <User className="w-3 h-3" />
                          <span className="truncate">{appointment.customer.full_name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(appointment.scheduled_date)}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(appointment.scheduled_time)}</span>
                      </div>

                      {appointment.vehicle && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Car className="w-3 h-3" />
                          <span className="truncate">
                            {appointment.vehicle.year} {appointment.vehicle.make} {appointment.vehicle.model}
                          </span>
                        </div>
                      )}

                      {appointment.location_id && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">
                            {locations.find((loc) => loc.id === appointment.location_id)?.name}
                          </span>
                        </div>
                      )}

                      {appointment.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-2 pt-2 border-t border-slate-100">
                          {appointment.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
