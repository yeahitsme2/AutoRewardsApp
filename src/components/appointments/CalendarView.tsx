import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
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
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<'week' | 'month'>('week');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const getWeekDates = (date: Date) => {
    const day = date.getDay();
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - day);
    sunday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return d;
    });
  };

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  const monthDates = useMemo(() => {
    const days = daysInMonth(currentDate);
    const firstDay = firstDayOfMonth(currentDate);
    const dates: (Date | null)[] = Array.from({ length: firstDay }, () => null);
    for (let i = 1; i <= days; i++) {
      dates.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
    }
    return dates;
  }, [currentDate]);

  const getAppointmentsForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return appointments
      .filter((apt) => apt.scheduled_date === dateStr)
      .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
  };

  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'pending': return { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' };
      case 'cancelled': return { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' };
      case 'completed': return { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' };
      default: return { bg: `${brandColor}18`, border: brandColor, text: brandColor };
    }
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  };

  const headerLabel = view === 'week'
    ? (() => {
        const first = weekDates[0];
        const last = weekDates[6];
        if (first.getMonth() === last.getMonth()) {
          return `${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        }
        return `${first.toLocaleDateString('en-US', { month: 'short' })} – ${last.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
      })()
    : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const expandedDateStr = expandedDay;
  const expandedApts = expandedDateStr
    ? appointments.filter((a) => a.scheduled_date === expandedDateStr).sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-lg font-semibold text-slate-900 min-w-[180px] text-center">{headerLabel}</h3>
          <button
            onClick={navigateNext}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            Today
          </button>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setView('week')}
            className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${
              view === 'week' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${
              view === 'month' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {view === 'week' ? (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1.5 min-w-[640px]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
              const date = weekDates[idx];
              const dayApts = getAppointmentsForDate(date);
              const todayStyle = isToday(date);
              return (
                <div key={day} className="text-center">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{day}</div>
                  <div
                    className={`min-h-[380px] border-2 rounded-xl p-2 transition-colors ${
                      todayStyle ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className={`text-base font-bold mb-2 w-7 h-7 flex items-center justify-center rounded-full mx-auto ${
                      todayStyle ? 'bg-blue-500 text-white' : 'text-slate-900'
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayApts.map((apt) => {
                        const styles = getStatusStyles(apt.status);
                        return (
                          <button
                            key={apt.id}
                            onClick={() => onAppointmentClick(apt)}
                            className="w-full text-left p-1.5 rounded-lg border text-xs hover:shadow-md transition-all"
                            style={{ backgroundColor: styles.bg, borderColor: styles.border, color: styles.text }}
                          >
                            <div className="font-semibold truncate">{formatTime(apt.scheduled_time)}</div>
                            <div className="truncate">{apt.customer?.full_name}</div>
                            <div className="truncate opacity-75">{apt.service_type}</div>
                          </button>
                        );
                      })}
                      {dayApts.length === 0 && (
                        <div className="text-xs text-slate-300 text-center mt-4">—</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide py-2">
                {day}
              </div>
            ))}
            {monthDates.map((date, idx) => {
              const dayApts = getAppointmentsForDate(date);
              const todayStyle = isToday(date);
              const dateKey = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null;
              return (
                <div
                  key={idx}
                  className={`min-h-[96px] border rounded-xl p-1.5 ${
                    date ? (todayStyle ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-white') : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  {date && (
                    <>
                      <div className={`text-xs font-bold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                        todayStyle ? 'bg-blue-500 text-white' : 'text-slate-700'
                      }`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayApts.slice(0, 2).map((apt) => {
                          const styles = getStatusStyles(apt.status);
                          return (
                            <button
                              key={apt.id}
                              onClick={() => onAppointmentClick(apt)}
                              className="w-full text-left px-1 py-0.5 rounded text-xs truncate border"
                              style={{ backgroundColor: styles.bg, borderColor: styles.border, color: styles.text }}
                            >
                              {formatTime(apt.scheduled_time)} {apt.customer?.full_name}
                            </button>
                          );
                        })}
                        {dayApts.length > 2 && (
                          <button
                            onClick={() => setExpandedDay(expandedDay === dateKey ? null : dateKey)}
                            className="text-xs font-medium w-full text-left px-1 py-0.5 rounded hover:bg-slate-100 transition-colors"
                            style={{ color: brandColor }}
                          >
                            +{dayApts.length - 2} more
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {expandedDay && expandedApts.length > 0 && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setExpandedDay(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">
                    {new Date(expandedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    <span className="text-slate-500 font-normal ml-2 text-sm">({expandedApts.length} appointments)</span>
                  </h3>
                  <button onClick={() => setExpandedDay(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {expandedApts.map((apt) => {
                    const styles = getStatusStyles(apt.status);
                    return (
                      <button
                        key={apt.id}
                        onClick={() => { onAppointmentClick(apt); setExpandedDay(null); }}
                        className="w-full text-left p-3 rounded-xl border transition-all hover:shadow-md"
                        style={{ backgroundColor: styles.bg, borderColor: styles.border }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm" style={{ color: styles.text }}>{formatTime(apt.scheduled_time)}</p>
                            <p className="font-medium text-slate-900 truncate">{apt.service_type}</p>
                            {apt.customer && <p className="text-xs text-slate-500 truncate">{apt.customer.full_name}</p>}
                          </div>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 capitalize"
                            style={{ backgroundColor: styles.border, color: '#fff' }}
                          >
                            {apt.status}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
