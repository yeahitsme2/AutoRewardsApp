import { useState } from 'react';
import { Clock, User, Car, Calendar, MapPin, GripVertical } from 'lucide-react';
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
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const columns: { status: 'pending' | 'confirmed' | 'completed' | 'cancelled'; title: string; color: string; bg: string }[] = [
    { status: 'pending', title: 'Pending', color: '#d97706', bg: '#fef3c7' },
    { status: 'confirmed', title: 'Confirmed', color: brandColor, bg: `${brandColor}15` },
    { status: 'completed', title: 'Completed', color: '#2563eb', bg: '#dbeafe' },
    { status: 'cancelled', title: 'Cancelled', color: '#dc2626', bg: '#fee2e2' },
  ];

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (dateStr === today) return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDragStart = (e: React.DragEvent, appointmentId: string) => {
    setDraggedId(appointmentId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (status: 'pending' | 'confirmed' | 'cancelled' | 'completed') => {
    if (draggedId) {
      onStatusChange(draggedId, status);
      setDraggedId(null);
      setDragOverColumn(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverColumn(null);
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max lg:min-w-0 lg:grid lg:grid-cols-4">
        {columns.map((column) => {
          const columnAppointments = appointments.filter((apt) => apt.status === column.status);
          const isDragOver = dragOverColumn === column.status;

          return (
            <div
              key={column.status}
              className={`rounded-xl p-4 min-h-[500px] w-72 lg:w-auto transition-all duration-150 ${
                isDragOver ? 'scale-[1.01]' : ''
              }`}
              style={{
                backgroundColor: isDragOver ? column.bg : '#f8fafc',
                outline: isDragOver ? `2px solid ${column.color}` : undefined,
                outlineOffset: '1px',
              }}
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(column.status)}
            >
              <div
                className="flex items-center justify-between mb-4 pb-3 border-b-2"
                style={{ borderColor: column.color }}
              >
                <h3 className="font-semibold text-slate-900">{column.title}</h3>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: column.color }}
                >
                  {columnAppointments.length}
                </span>
              </div>

              {columnAppointments.length === 0 && (
                <div
                  className={`flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed text-sm transition-colors ${
                    isDragOver ? 'border-current text-current opacity-60' : 'border-slate-200 text-slate-400'
                  }`}
                  style={isDragOver ? { borderColor: column.color, color: column.color } : undefined}
                >
                  {isDragOver ? 'Drop here' : 'No appointments'}
                </div>
              )}

              <div className="space-y-2">
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
                      onDragStart={(e) => handleDragStart(e, appointment.id)}
                      onDragEnd={handleDragEnd}
                      className="bg-white rounded-xl border border-slate-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group"
                      style={{
                        opacity: draggedId === appointment.id ? 0.4 : 1,
                        borderLeftWidth: '3px',
                        borderLeftColor: column.color,
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="font-medium text-slate-900 text-sm leading-tight truncate">{appointment.service_type}</h4>
                          </div>

                          {appointment.customer && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <User className="w-3 h-3 shrink-0" />
                              <span className="truncate font-medium">{appointment.customer.full_name}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(appointment.scheduled_date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(appointment.scheduled_time)}
                            </span>
                          </div>

                          {appointment.vehicle && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Car className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {appointment.vehicle.year} {appointment.vehicle.make} {appointment.vehicle.model}
                              </span>
                            </div>
                          )}

                          {appointment.location_id && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {locations.find((loc) => loc.id === appointment.location_id)?.name}
                              </span>
                            </div>
                          )}

                          {appointment.description && (
                            <p className="text-xs text-slate-500 line-clamp-2 pt-1.5 border-t border-slate-100">
                              {appointment.description}
                            </p>
                          )}

                          <button
                            onClick={() => onAppointmentClick(appointment)}
                            className="text-xs font-medium transition-colors mt-1"
                            style={{ color: column.color }}
                          >
                            Edit details
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
