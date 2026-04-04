import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Car, User, MapPin, CheckCircle, XCircle, AlertCircle, Mail, ClipboardList, ExternalLink, FileText, CreditCard as Edit3, ChevronRight, Phone } from 'lucide-react';
import type { Appointment, AppointmentType, Customer, ShopLocation, Vehicle } from '../../types/database';

interface AppointmentWithDetails extends Appointment {
  customer?: Customer;
  vehicle?: Vehicle;
  repair_order_id?: string | null;
}

interface AppointmentDetailPanelProps {
  appointment: AppointmentWithDetails | null;
  locations: ShopLocation[];
  appointmentTypes: AppointmentType[];
  brandColor: string;
  onClose: () => void;
  onConfirm: (appointment: AppointmentWithDetails) => void;
  onCancel: (appointment: AppointmentWithDetails) => void;
  onComplete: (appointment: AppointmentWithDetails) => void;
  onNoShow: (appointment: AppointmentWithDetails) => void;
  onEdit: (appointment: AppointmentWithDetails) => void;
  onSendReminder: (appointment: AppointmentWithDetails) => void;
  onCreateRO: (appointment: AppointmentWithDetails) => void;
  onQuickConfirm: (appointmentId: string) => void;
}

export function AppointmentDetailPanel({
  appointment,
  locations,
  appointmentTypes,
  brandColor,
  onClose,
  onConfirm,
  onCancel,
  onComplete,
  onNoShow,
  onEdit,
  onSendReminder,
  onCreateRO,
  onQuickConfirm,
}: AppointmentDetailPanelProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (appointment) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [appointment]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusConfig = (status: string, cancellationType?: 'cancelled' | 'no-show' | null) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertCircle };
      case 'confirmed':
        return { label: 'Confirmed', bg: '', text: '', icon: CheckCircle, custom: true };
      case 'completed':
        return { label: 'Completed', bg: 'bg-blue-100', text: 'text-blue-800', icon: CheckCircle };
      case 'cancelled':
        return {
          label: cancellationType === 'no-show' ? 'No Show' : 'Cancelled',
          bg: 'bg-red-100',
          text: 'text-red-800',
          icon: XCircle
        };
      default:
        return { label: status, bg: 'bg-slate-100', text: 'text-slate-700', icon: AlertCircle };
    }
  };

  if (!appointment) return null;

  const statusConfig = getStatusConfig(appointment.status, appointment.cancellation_type);
  const StatusIcon = statusConfig.icon;
  const location = locations.find(l => l.id === appointment.location_id);
  const appointmentType = appointmentTypes.find(t => t.id === appointment.appointment_type_id);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            {statusConfig.custom ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full"
                style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {statusConfig.label}
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {statusConfig.label}
              </span>
            )}
            {appointment.cancellation_type === 'no-show' && (
              <span className="text-xs text-slate-400">No Show</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(appointment)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Edit appointment"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-1">{appointment.service_type}</h2>
            {appointmentType && (
              <p className="text-sm text-slate-500">{appointmentType.name}</p>
            )}
          </div>

          <div className="px-5 py-4 space-y-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{formatDate(appointment.scheduled_date)}</p>
                <p className="text-xs text-slate-500">Date</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{formatTime(appointment.scheduled_time)}</p>
                <p className="text-xs text-slate-500">
                  {appointment.duration_minutes ? `${appointment.duration_minutes} min` : 'Time'}
                </p>
              </div>
            </div>
            {location && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{location.name}</p>
                  <p className="text-xs text-slate-500">Location</p>
                </div>
              </div>
            )}
          </div>

          {appointment.customer && (
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Customer</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-slate-900">{appointment.customer.full_name}</span>
                </div>
                {appointment.customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <a href={`mailto:${appointment.customer.email}`} className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                      {appointment.customer.email}
                    </a>
                  </div>
                )}
                {appointment.customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <a href={`tel:${appointment.customer.phone}`} className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                      {appointment.customer.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {appointment.vehicle && (
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Vehicle</p>
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-slate-900">
                  {appointment.vehicle.year} {appointment.vehicle.make} {appointment.vehicle.model}
                </span>
              </div>
              {appointment.vehicle.license_plate && (
                <p className="text-xs text-slate-500 mt-1 ml-6">{appointment.vehicle.license_plate}</p>
              )}
              {appointment.vehicle.color && (
                <p className="text-xs text-slate-500 mt-0.5 ml-6">{appointment.vehicle.color}</p>
              )}
            </div>
          )}

          {(appointment.description || (appointment as any).admin_notes) && (
            <div className="px-5 py-4 border-b border-slate-100 space-y-3">
              {appointment.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Customer Notes</p>
                  <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700 leading-relaxed">
                    {appointment.description}
                  </div>
                </div>
              )}
              {(appointment as any).admin_notes && (
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Shop Notes
                  </p>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800 leading-relaxed">
                    {(appointment as any).admin_notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {appointment.status === 'cancelled' && appointment.cancelled_reason && (
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">Cancellation Reason</p>
              <p className="text-sm text-red-700 italic">"{appointment.cancelled_reason}"</p>
            </div>
          )}

          {appointment.repair_order_id && (
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">Repair Order Created</span>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          {appointment.status === 'pending' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { onConfirm(appointment); handleClose(); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: brandColor }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirm
                </button>
                <button
                  onClick={() => { onCancel(appointment); handleClose(); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-semibold rounded-xl transition-all active:scale-95"
                >
                  <XCircle className="w-4 h-4" />
                  Decline
                </button>
              </div>
            </div>
          )}

          {appointment.status === 'confirmed' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { onComplete(appointment); handleClose(); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-all active:scale-95"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete
                </button>
                {!appointment.repair_order_id ? (
                  <button
                    onClick={() => { onCreateRO(appointment); handleClose(); }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: brandColor }}
                  >
                    <ClipboardList className="w-4 h-4" />
                    Create RO
                  </button>
                ) : (
                  <button
                    onClick={() => onSendReminder(appointment)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded-xl transition-all active:scale-95"
                  >
                    <Mail className="w-4 h-4" />
                    Remind
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {appointment.repair_order_id && (
                  <button
                    onClick={() => onSendReminder(appointment)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-xl transition-all active:scale-95 col-span-1"
                  >
                    <Mail className="w-4 h-4" />
                    Remind
                  </button>
                )}
                <button
                  onClick={() => { onNoShow(appointment); handleClose(); }}
                  className={`flex items-center justify-center gap-2 px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 text-sm font-medium rounded-xl transition-all active:scale-95 ${appointment.repair_order_id ? 'col-span-1' : 'col-span-1'}`}
                >
                  <AlertCircle className="w-4 h-4" />
                  No Show
                </button>
                <button
                  onClick={() => { onCancel(appointment); handleClose(); }}
                  className={`flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-xl transition-all active:scale-95 ${!appointment.repair_order_id ? 'col-span-2' : 'col-span-2'}`}
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {appointment.status === 'completed' && !appointment.repair_order_id && (
            <button
              onClick={() => { onCreateRO(appointment); handleClose(); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white text-sm font-semibold rounded-xl transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: brandColor }}
            >
              <ClipboardList className="w-4 h-4" />
              Create Repair Order
            </button>
          )}

          {(appointment.status === 'completed' || appointment.status === 'cancelled') && appointment.repair_order_id && (
            <div className="text-center text-sm text-slate-500 py-1">No further actions needed</div>
          )}
        </div>
      </div>
    </>
  );
}
