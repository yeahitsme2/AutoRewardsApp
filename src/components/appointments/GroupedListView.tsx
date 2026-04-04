import { Calendar, Clock, Car, User, CheckCircle, XCircle, AlertCircle, MapPin, ClipboardList, ExternalLink, ChevronRight } from 'lucide-react';
import type { Appointment, AppointmentType, Customer, ShopLocation, Vehicle } from '../../types/database';

interface AppointmentWithDetails extends Appointment {
  customer?: Customer;
  vehicle?: Vehicle;
  repair_order_id?: string | null;
  selected?: boolean;
}

interface GroupedListViewProps {
  appointments: AppointmentWithDetails[];
  locations: ShopLocation[];
  appointmentTypes: AppointmentType[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  onConfirm: (appointment: AppointmentWithDetails) => void;
  onCancel: (appointment: AppointmentWithDetails) => void;
  onComplete: (appointment: AppointmentWithDetails) => void;
  onNoShow: (appointment: AppointmentWithDetails) => void;
  onEdit: (appointment: AppointmentWithDetails) => void;
  onSendReminder: (appointment: AppointmentWithDetails) => void;
  onCreateRO: (appointment: AppointmentWithDetails) => void;
  onToggleSelect: (appointmentId: string) => void;
  onQuickConfirm: (appointmentId: string) => void;
  brandColor: string;
}

export function GroupedListView({
  appointments,
  locations,
  onAppointmentClick,
  onConfirm,
  onCancel,
  onComplete,
  onNoShow,
  onCreateRO,
  onToggleSelect,
  onQuickConfirm,
  brandColor,
}: GroupedListViewProps) {
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDateGroup = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date < today) return 'Past';
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
    if (date <= weekFromNow) return 'This Week';
    return 'Later';
  };

  const getStatusAccent = (status: string) => {
    switch (status) {
      case 'pending': return 'border-l-yellow-400 bg-yellow-50/40';
      case 'confirmed': return 'border-l-blue-400 bg-blue-50/20';
      case 'completed': return 'border-l-emerald-400 bg-emerald-50/20';
      case 'cancelled': return 'border-l-red-300 bg-red-50/20 opacity-75';
      default: return 'border-l-slate-300';
    }
  };

  const getStatusBadge = (status: string, cancellationType?: 'cancelled' | 'no-show' | null, brandColor?: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
            <AlertCircle className="w-3 h-3" />
            Pending
          </span>
        );
      case 'confirmed':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full"
            style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
          >
            <CheckCircle className="w-3 h-3" />
            Confirmed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
            <XCircle className="w-3 h-3" />
            {cancellationType === 'no-show' ? 'No Show' : 'Cancelled'}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  const groupedAppointments = appointments.reduce((groups, apt) => {
    const group = getDateGroup(apt.scheduled_date);
    if (!groups[group]) groups[group] = [];
    groups[group].push(apt);
    return groups;
  }, {} as Record<string, AppointmentWithDetails[]>);

  const groupOrder = ['Past', 'Today', 'Tomorrow', 'This Week', 'Later'];
  const sortedGroups = groupOrder.filter(group => groupedAppointments[group]?.length > 0);

  const getGroupStyle = (group: string) => {
    if (group === 'Today') return 'text-slate-900 font-bold';
    if (group === 'Past') return 'text-slate-400';
    return 'text-slate-700 font-semibold';
  };

  const getTodayIndicator = (group: string) => {
    if (group === 'Today') {
      return (
        <span className="ml-2 px-2 py-0.5 bg-slate-900 text-white text-xs rounded-full font-medium">
          Today
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {sortedGroups.map(groupName => (
        <div key={groupName}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className={`text-base ${getGroupStyle(groupName)}`}>
              {groupName !== 'Today' ? groupName : ''}
              {getTodayIndicator(groupName)}
            </h3>
            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {groupedAppointments[groupName].length}
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="space-y-2">
            {groupedAppointments[groupName]
              .sort((a, b) => {
                const dateCompare = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
                if (dateCompare !== 0) return dateCompare;
                return (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
              })
              .map(appointment => {
                const location = locations.find(l => l.id === appointment.location_id);
                return (
                  <div
                    key={appointment.id}
                    className={`bg-white rounded-xl border border-slate-200 border-l-4 transition-all hover:shadow-md cursor-pointer ${
                      getStatusAccent(appointment.status)
                    } ${appointment.selected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                  >
                    <div
                      className="flex items-stretch"
                      onClick={() => onAppointmentClick(appointment)}
                    >
                      <div className="flex items-center px-3 py-3 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={appointment.selected || false}
                          onChange={(e) => { e.stopPropagation(); onToggleSelect(appointment.id); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                          style={{ accentColor: brandColor }}
                        />
                      </div>

                      <div className="flex-1 flex items-center gap-4 py-3 pr-3 min-w-0">
                        <div className="flex-shrink-0 text-center min-w-[52px]">
                          <p className="text-xs text-slate-500 leading-none">{formatDate(appointment.scheduled_date).split(',')[0]}</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">{formatTime(appointment.scheduled_time)}</p>
                          {appointment.duration_minutes && (
                            <p className="text-xs text-slate-400 mt-0.5">{appointment.duration_minutes}m</p>
                          )}
                        </div>

                        <div className="w-px bg-slate-200 self-stretch flex-shrink-0" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold text-slate-900 truncate">{appointment.service_type}</span>
                            {getStatusBadge(appointment.status, appointment.cancellation_type, brandColor)}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                            {appointment.customer && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 flex-shrink-0" />
                                {appointment.customer.full_name}
                              </span>
                            )}
                            {appointment.vehicle && (
                              <span className="flex items-center gap-1">
                                <Car className="w-3 h-3 flex-shrink-0" />
                                {appointment.vehicle.year} {appointment.vehicle.make}
                              </span>
                            )}
                            {location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                {location.name}
                              </span>
                            )}
                            {appointment.repair_order_id && (
                              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                RO
                              </span>
                            )}
                          </div>
                          {appointment.description && (
                            <p className="text-xs text-slate-400 mt-1 truncate">{appointment.description}</p>
                          )}
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </div>
                    </div>

                    {(appointment.status === 'pending' || appointment.status === 'confirmed') && (
                      <div
                        className="flex items-center gap-1.5 px-3 pb-2.5 border-t border-slate-100 pt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {appointment.status === 'pending' && (
                          <>
                            <button
                              onClick={() => onQuickConfirm(appointment.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-white text-xs font-medium rounded-lg transition-all hover:opacity-90 active:scale-95"
                              style={{ backgroundColor: brandColor }}
                            >
                              <CheckCircle className="w-3 h-3" />
                              Confirm
                            </button>
                            <button
                              onClick={() => onCancel(appointment)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition-all active:scale-95"
                            >
                              <XCircle className="w-3 h-3" />
                              Decline
                            </button>
                          </>
                        )}
                        {appointment.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => onComplete(appointment)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium rounded-lg transition-all active:scale-95"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Complete
                            </button>
                            {!appointment.repair_order_id && (
                              <button
                                onClick={() => onCreateRO(appointment)}
                                className="flex items-center gap-1 px-2.5 py-1 text-white text-xs font-medium rounded-lg transition-all hover:opacity-90 active:scale-95"
                                style={{ backgroundColor: brandColor }}
                              >
                                <ClipboardList className="w-3 h-3" />
                                Create RO
                              </button>
                            )}
                            <button
                              onClick={() => onNoShow(appointment)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-medium rounded-lg transition-all active:scale-95"
                            >
                              <AlertCircle className="w-3 h-3" />
                              No Show
                            </button>
                            <button
                              onClick={() => onCancel(appointment)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition-all active:scale-95"
                            >
                              <XCircle className="w-3 h-3" />
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {appointment.status === 'completed' && !appointment.repair_order_id && (
                      <div
                        className="flex items-center gap-1.5 px-3 pb-2.5 border-t border-slate-100 pt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onCreateRO(appointment)}
                          className="flex items-center gap-1 px-2.5 py-1 text-white text-xs font-semibold rounded-lg transition-all hover:opacity-90 active:scale-95"
                          style={{ backgroundColor: brandColor }}
                        >
                          <ClipboardList className="w-3 h-3" />
                          Create Repair Order
                        </button>
                      </div>
                    )}

                    {appointment.status === 'cancelled' && appointment.cancelled_reason && (
                      <div className="px-3 pb-2.5 pt-0">
                        <p className="text-xs text-red-500 italic truncate">"{appointment.cancelled_reason}"</p>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
