import { Calendar, Clock, Car, User, CheckCircle, XCircle, AlertCircle, CreditCard as Edit2, MapPin, Mail, ClipboardList, ExternalLink, FileText } from 'lucide-react';
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
  brandColor: string;
}

export function GroupedListView({
  appointments,
  locations,
  appointmentTypes,
  onAppointmentClick,
  onConfirm,
  onCancel,
  onComplete,
  onNoShow,
  onEdit,
  onSendReminder,
  onCreateRO,
  onToggleSelect,
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
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDateGroup = (dateStr: string) => {
    const date = new Date(dateStr);
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

  const groupedAppointments = appointments.reduce((groups, apt) => {
    const group = getDateGroup(apt.scheduled_date);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(apt);
    return groups;
  }, {} as Record<string, AppointmentWithDetails[]>);

  const groupOrder = ['Past', 'Today', 'Tomorrow', 'This Week', 'Later'];
  const sortedGroups = groupOrder.filter((group) => groupedAppointments[group]?.length > 0);

  const getStatusBadge = (status: string, cancellationType?: 'cancelled' | 'no-show' | null) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
            <AlertCircle className="w-4 h-4" />
            Pending
          </span>
        );
      case 'confirmed':
        return (
          <span
            className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full"
            style={{
              backgroundColor: `${brandColor}20`,
              color: brandColor
            }}
          >
            <CheckCircle className="w-4 h-4" />
            Confirmed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
            <XCircle className="w-4 h-4" />
            {cancellationType === 'no-show' ? 'No Show' : 'Cancelled'}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
            <CheckCircle className="w-4 h-4" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {sortedGroups.map((groupName) => (
        <div key={groupName}>
          <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            {groupName}
            <span className="text-sm font-normal text-slate-500">
              ({groupedAppointments[groupName].length})
            </span>
          </h3>
          <div className="space-y-3">
            {groupedAppointments[groupName]
              .sort((a, b) => {
                const dateCompare = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
                if (dateCompare !== 0) return dateCompare;
                return (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
              })
              .map((appointment) => (
                <div
                  key={appointment.id}
                  className={`bg-white rounded-xl shadow-sm border-2 p-4 transition-all ${
                    appointment.selected ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={appointment.selected || false}
                      onChange={() => onToggleSelect(appointment.id)}
                      className="mt-1 w-4 h-4 rounded border-slate-300"
                      style={{ accentColor: brandColor }}
                    />

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-semibold text-slate-900">{appointment.service_type}</h4>
                          {getStatusBadge(appointment.status, appointment.cancellation_type)}
                        </div>
                        <button
                          onClick={() => onEdit(appointment)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="space-y-2 text-sm">
                          {appointment.customer && (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-900 font-medium">{appointment.customer.full_name}</span>
                            </div>
                          )}
                          {appointment.customer?.email && (
                            <div className="text-slate-600 ml-6">{appointment.customer.email}</div>
                          )}
                          {appointment.customer?.phone && (
                            <div className="text-slate-600 ml-6">{appointment.customer.phone}</div>
                          )}
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-900">{formatDate(appointment.scheduled_date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-900">{formatTime(appointment.scheduled_time)}</span>
                          </div>
                          {appointment.location_id && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-900">
                                {locations.find((loc) => loc.id === appointment.location_id)?.name || 'Location'}
                              </span>
                            </div>
                          )}
                          {appointment.vehicle && (
                            <div className="flex items-center gap-2">
                              <Car className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-900">
                                {appointment.vehicle.year} {appointment.vehicle.make} {appointment.vehicle.model}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {(appointment.description || (appointment as any).admin_notes) && (
                        <div className="mb-3 space-y-2">
                          {appointment.description && (
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Customer Notes</p>
                              <p className="text-sm text-slate-700">{appointment.description}</p>
                            </div>
                          )}
                          {(appointment as any).admin_notes && (
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                                <FileText className="w-3 h-3" /> Shop Notes
                              </p>
                              <p className="text-sm text-amber-800">{(appointment as any).admin_notes}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        {appointment.status === 'pending' && (
                          <>
                            <button
                              onClick={() => onConfirm(appointment)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-medium rounded-lg transition-colors"
                              style={{ backgroundColor: brandColor }}
                            >
                              <CheckCircle className="w-4 h-4" />
                              Confirm
                            </button>
                            <button
                              onClick={() => onCancel(appointment)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                              Cancel
                            </button>
                          </>
                        )}

                        {appointment.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => onComplete(appointment)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Complete
                            </button>
                            {appointment.repair_order_id ? (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium rounded-lg">
                                <ExternalLink className="w-4 h-4" />
                                RO Created
                              </span>
                            ) : (
                              <button
                                onClick={() => onCreateRO(appointment)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-medium rounded-lg transition-colors"
                                style={{ backgroundColor: brandColor }}
                              >
                                <ClipboardList className="w-4 h-4" />
                                Create RO
                              </button>
                            )}
                            <button
                              onClick={() => onSendReminder(appointment)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                            >
                              <Mail className="w-4 h-4" />
                              Remind
                            </button>
                            <button
                              onClick={() => onNoShow(appointment)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 text-sm font-medium rounded-lg transition-colors"
                            >
                              <AlertCircle className="w-4 h-4" />
                              No Show
                            </button>
                            <button
                              onClick={() => onCancel(appointment)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                              Cancel
                            </button>
                          </>
                        )}

                        {appointment.status === 'completed' && (
                          appointment.repair_order_id ? (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium rounded-lg">
                              <ExternalLink className="w-4 h-4" />
                              RO Created
                            </span>
                          ) : (
                            <button
                              onClick={() => onCreateRO(appointment)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-medium rounded-lg transition-colors"
                              style={{ backgroundColor: brandColor }}
                            >
                              <ClipboardList className="w-4 h-4" />
                              Create RO
                            </button>
                          )
                        )}

                        {appointment.status === 'cancelled' && appointment.cancelled_reason && (
                          <p className="text-sm text-red-600 italic">"{appointment.cancelled_reason}"</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
