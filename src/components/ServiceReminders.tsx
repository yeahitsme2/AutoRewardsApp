import { AlertCircle, Bell, Calendar, Gauge } from 'lucide-react';
import type { Vehicle } from '../types/database';
import { calculateServiceReminders } from '../lib/rewardsUtils';

interface ServiceRemindersProps {
  vehicles: Vehicle[];
}

export function ServiceReminders({ vehicles }: ServiceRemindersProps) {
  const vehiclesWithReminders = vehicles
    .map((vehicle) => {
      const reminder = calculateServiceReminders(
        vehicle.last_service_date,
        vehicle.last_service_mileage,
        vehicle.current_mileage,
        vehicle.next_service_due_date,
        vehicle.next_service_due_mileage
      );

      return { vehicle, reminder };
    })
    .filter(({ reminder }) => reminder !== null);

  if (vehiclesWithReminders.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <Bell className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Service Reminders</h3>
          <p className="text-sm text-slate-600">Keep your vehicles in top condition</p>
        </div>
      </div>

      <div className="space-y-3">
        {vehiclesWithReminders.map(({ vehicle, reminder }) => {
          if (!reminder) return null;

          const isOverdue = reminder.type === 'overdue';
          const isDueSoon = reminder.type === 'due-soon';

          return (
            <div
              key={vehicle.id}
              className={`p-4 rounded-lg border-l-4 ${
                isOverdue
                  ? 'bg-red-50 border-red-500'
                  : isDueSoon
                  ? 'bg-orange-50 border-orange-500'
                  : 'bg-blue-50 border-blue-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <AlertCircle
                    className={`w-5 h-5 ${
                      isOverdue
                        ? 'text-red-600'
                        : isDueSoon
                        ? 'text-orange-600'
                        : 'text-blue-600'
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  <p
                    className={`text-sm ${
                      isOverdue
                        ? 'text-red-700'
                        : isDueSoon
                        ? 'text-orange-700'
                        : 'text-blue-700'
                    }`}
                  >
                    {reminder.message}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
                    {reminder.daysOverdue !== undefined && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{reminder.daysOverdue} days overdue</span>
                      </div>
                    )}
                    {reminder.daysUntilDue !== undefined && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Due in {reminder.daysUntilDue} days</span>
                      </div>
                    )}
                    {reminder.milesOverdue !== undefined && (
                      <div className="flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        <span>{reminder.milesOverdue} miles overdue</span>
                      </div>
                    )}
                    {reminder.milesUntilDue !== undefined && (
                      <div className="flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        <span>{reminder.milesUntilDue} miles until due</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
