import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Car, MapPin } from 'lucide-react';
import type { Appointment, Customer, Vehicle, ShopLocation } from '../../types/database';

interface AppointmentWithDetails extends Appointment {
  customer?: Customer;
  vehicle?: Vehicle;
}

interface CalendarViewProps {
  appointments: AppointmentWithDetails[];
  locations: ShopLocation[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  brandColor: string;
}

export function CalendarView({ appointments, locations, onAppointmentClick, brandColor }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('week');

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getWeekDates = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day;
    const sunday = new Date(date.setDate(diff));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = useMemo(() => getWeekDates(new Date(currentDate)), [currentDate]);

  const monthDates = useMemo(() => {
    const days = daysInMonth(currentDate);
    const firstDay = firstDayOfMonth(currentDate);
    const dates = [];

    for (let i = 0; i < firstDay; i++) {
      dates.push(null);
    }

    for (let i = 1; i <= days; i++) {
      dates.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
    }

    return dates;
  }, [currentDate]);

  const getAppointmentsForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return appointments.filter(apt => apt.scheduled_date === dateStr);
  };

  const navigatePrev = () => {
    if (view === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
    } else {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setCurrentDate(newDate);
    }
  };

  const navigateNext = () => {
    if (view === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
    } else {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setCurrentDate(newDate);
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'confirmed': return 'border-2 text-slate-900';
      case 'cancelled': return 'bg-red-100 border-red-300 text-red-800';
      case 'completed': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-slate-100 border-slate-300 text-slate-800';
    }
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={navigatePrev}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-semibold text-slate-900 min-w-[200px] text-center">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={navigateNext}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('week')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'week' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            style={view === 'week' ? { backgroundColor: brandColor } : undefined}
          >
            Week
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'month' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            style={view === 'month' ? { backgroundColor: brandColor } : undefined}
          >
            Month
          </button>
        </div>
      </div>

      {view === 'week' ? (
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
            <div key={day} className="text-center">
              <div className="font-semibold text-slate-700 mb-2">{day}</div>
              <div className={`min-h-[400px] border-2 rounded-lg p-2 ${
                isToday(weekDates[idx]) ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'
              }`}>
                <div className="text-lg font-semibold text-slate-900 mb-2">
                  {weekDates[idx].getDate()}
                </div>
                <div className="space-y-1">
                  {getAppointmentsForDate(weekDates[idx])
                    .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))
                    .map((apt) => (
                      <button
                        key={apt.id}
                        onClick={() => onAppointmentClick(apt)}
                        className={`w-full text-left p-2 rounded border text-xs hover:shadow-md transition-all ${getStatusColor(apt.status)}`}
                        style={apt.status === 'confirmed' ? { borderColor: brandColor } : undefined}
                      >
                        <div className="font-medium truncate">{formatTime(apt.scheduled_time)}</div>
                        <div className="truncate">{apt.customer?.full_name}</div>
                        <div className="truncate opacity-75">{apt.service_type}</div>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center font-semibold text-slate-700 py-2">
              {day}
            </div>
          ))}
          {monthDates.map((date, idx) => (
            <div
              key={idx}
              className={`min-h-[100px] border rounded-lg p-1 ${
                date ? (isToday(date) ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white') : 'bg-slate-50'
              }`}
            >
              {date && (
                <>
                  <div className="text-sm font-semibold text-slate-900 mb-1">
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {getAppointmentsForDate(date).slice(0, 3).map((apt) => (
                      <button
                        key={apt.id}
                        onClick={() => onAppointmentClick(apt)}
                        className={`w-full text-left px-1 py-0.5 rounded text-xs truncate ${getStatusColor(apt.status)}`}
                      >
                        {formatTime(apt.scheduled_time)} - {apt.customer?.full_name}
                      </button>
                    ))}
                    {getAppointmentsForDate(date).length > 3 && (
                      <div className="text-xs text-slate-500 px-1">
                        +{getAppointmentsForDate(date).length - 3} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
