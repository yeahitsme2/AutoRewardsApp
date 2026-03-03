import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { Appointment, AppointmentType, ShopLocation } from '../../types/database';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  brandColor: string;
}

export function ConfirmAppointmentModal({ isOpen, onClose, onConfirm, brandColor }: ConfirmModalProps) {
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Confirm Appointment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Confirmation Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add any notes about the confirmation..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none resize-none"
            style={{ focusRing: `${brandColor}50` }}
          />
        </div>
        <div className="flex gap-3 p-6 border-t border-slate-200">
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 text-white font-medium rounded-lg transition-colors"
            style={{ backgroundColor: brandColor }}
          >
            Confirm Appointment
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel: (reason: string, type: 'cancelled' | 'no-show') => void;
}

export function CancelAppointmentModal({ isOpen, onClose, onCancel }: CancelModalProps) {
  const [reason, setReason] = useState('');
  const [type, setType] = useState<'cancelled' | 'no-show'>('cancelled');

  if (!isOpen) return null;

  const handleCancel = () => {
    onCancel(reason, type);
    setReason('');
    setType('cancelled');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Cancel Appointment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Cancellation Type
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setType('cancelled')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  type === 'cancelled'
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Cancelled
              </button>
              <button
                onClick={() => setType('no-show')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  type === 'no-show'
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                No Show
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reason (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Enter cancellation reason..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 focus:border-transparent outline-none resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-slate-200">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
          >
            Cancel Appointment
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Appointment>) => void;
  appointment: Appointment;
  locations: ShopLocation[];
  appointmentTypes: AppointmentType[];
  brandColor: string;
}

export function EditAppointmentModal({ isOpen, onClose, onSave, appointment, locations, appointmentTypes, brandColor }: EditModalProps) {
  const [date, setDate] = useState(appointment.scheduled_date || '');
  const [time, setTime] = useState(appointment.scheduled_time || '');
  const [serviceType, setServiceType] = useState(appointment.service_type || '');
  const [description, setDescription] = useState(appointment.description || '');
  const [locationId, setLocationId] = useState(appointment.location_id || '');
  const [appointmentTypeId, setAppointmentTypeId] = useState(appointment.appointment_type_id || '');

  if (!isOpen) return null;

  const handleSave = () => {
    const updates: Partial<Appointment> = {
      scheduled_date: date,
      scheduled_time: time,
      service_type: serviceType,
      description,
      location_id: locationId || null,
      appointment_type_id: appointmentTypeId || null,
    };
    onSave(updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-slate-900">Edit Appointment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Service Type
            </label>
            <input
              type="text"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              placeholder="e.g., Oil Change, Brake Service"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none"
            />
          </div>

          {locations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none"
              >
                <option value="">Select location</option>
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
                Appointment Type
              </label>
              <select
                value={appointmentTypeId}
                onChange={(e) => setAppointmentTypeId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none"
              >
                <option value="">Select type</option>
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
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Customer notes and details..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-slate-200">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 text-white font-medium rounded-lg transition-colors"
            style={{ backgroundColor: brandColor }}
          >
            Save Changes
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (channel: 'email' | 'sms', message: string) => void;
  customerEmail?: string;
  customerPhone?: string;
  brandColor: string;
}

export function SendReminderModal({ isOpen, onClose, onSend, customerEmail, customerPhone, brandColor }: ReminderModalProps) {
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [message, setMessage] = useState('This is a reminder about your upcoming appointment.');

  if (!isOpen) return null;

  const handleSend = () => {
    onSend(channel, message);
    setMessage('This is a reminder about your upcoming appointment.');
    onClose();
  };

  const canSendEmail = Boolean(customerEmail);
  const canSendSMS = Boolean(customerPhone);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Send Reminder</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Send Via
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setChannel('email')}
                disabled={!canSendEmail}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  channel === 'email'
                    ? 'text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                style={channel === 'email' ? { backgroundColor: brandColor } : undefined}
              >
                Email
              </button>
              <button
                onClick={() => setChannel('sms')}
                disabled={!canSendSMS}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  channel === 'sms'
                    ? 'text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                style={channel === 'sms' ? { backgroundColor: brandColor } : undefined}
              >
                SMS
              </button>
            </div>
            {!canSendEmail && !canSendSMS && (
              <div className="mt-2 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>Customer has no email or phone number on file.</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Enter reminder message..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent outline-none resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-slate-200">
          <button
            onClick={handleSend}
            disabled={!canSendEmail && !canSendSMS}
            className="flex-1 px-4 py-2 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: brandColor }}
          >
            Send Reminder
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
