import type { Appointment, Customer, Vehicle } from '../types/database';

interface AppointmentWithDetails extends Appointment {
  customer?: Customer;
  vehicle?: Vehicle;
}

export function exportAppointmentsToCSV(appointments: AppointmentWithDetails[]) {
  const headers = [
    'Date',
    'Time',
    'Status',
    'Service Type',
    'Customer Name',
    'Customer Email',
    'Customer Phone',
    'Vehicle',
    'Description',
    'Admin Notes',
  ];

  const rows = appointments.map((apt) => [
    apt.scheduled_date || '',
    apt.scheduled_time || '',
    apt.status || '',
    apt.service_type || '',
    apt.customer?.full_name || '',
    apt.customer?.email || '',
    apt.customer?.phone || '',
    apt.vehicle
      ? `${apt.vehicle.year} ${apt.vehicle.make} ${apt.vehicle.model}`
      : '',
    apt.description || '',
    apt.admin_notes || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `appointments_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function filterAppointments(
  appointments: AppointmentWithDetails[],
  searchQuery: string,
  locationId: string,
  appointmentTypeId: string,
  dateFrom: string,
  dateTo: string
): AppointmentWithDetails[] {
  return appointments.filter((apt) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesCustomer = apt.customer?.full_name?.toLowerCase().includes(query) ||
                              apt.customer?.email?.toLowerCase().includes(query) ||
                              apt.customer?.phone?.toLowerCase().includes(query);
      const matchesVehicle = apt.vehicle?.make?.toLowerCase().includes(query) ||
                            apt.vehicle?.model?.toLowerCase().includes(query) ||
                            apt.vehicle?.year?.toString().includes(query);
      const matchesService = apt.service_type?.toLowerCase().includes(query);

      if (!matchesCustomer && !matchesVehicle && !matchesService) {
        return false;
      }
    }

    if (locationId && apt.location_id !== locationId) {
      return false;
    }

    if (appointmentTypeId && apt.appointment_type_id !== appointmentTypeId) {
      return false;
    }

    if (dateFrom && apt.scheduled_date < dateFrom) {
      return false;
    }

    if (dateTo && apt.scheduled_date > dateTo) {
      return false;
    }

    return true;
  });
}

export function sortAppointments(
  appointments: AppointmentWithDetails[],
  sortBy: 'date' | 'customer' | 'status',
  sortOrder: 'asc' | 'desc'
): AppointmentWithDetails[] {
  const sorted = [...appointments].sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case 'date':
        const dateA = `${a.scheduled_date} ${a.scheduled_time}`;
        const dateB = `${b.scheduled_date} ${b.scheduled_time}`;
        compareValue = dateA.localeCompare(dateB);
        break;
      case 'customer':
        const nameA = a.customer?.full_name || '';
        const nameB = b.customer?.full_name || '';
        compareValue = nameA.localeCompare(nameB);
        break;
      case 'status':
        const statusOrder = { pending: 0, confirmed: 1, completed: 2, cancelled: 3 };
        compareValue = (statusOrder[a.status as keyof typeof statusOrder] || 0) -
                      (statusOrder[b.status as keyof typeof statusOrder] || 0);
        break;
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  return sorted;
}
