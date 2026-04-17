import { createClient } from '@/lib/supabase/client';
import type {
  Salon,
  Professional,
  Service,
  ProfessionalAvailability,
  AvailabilityOverride,
  Appointment,
  AppointmentWithDetails,
  Profile,
} from '@/lib/types/database';

type ServiceRow = { service_id: string; services: Service };
type ProfessionalWithSalon = Professional & { salon: Salon };

export async function getActiveSalons(): Promise<Salon[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('salons')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data as Salon[];
}

export async function getSalonById(id: string): Promise<Salon | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('salons')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Salon;
}

export async function getActiveProfessionals(options?: { salonId?: string; offersHomeVisit?: boolean }): Promise<ProfessionalWithSalon[]> {
  const supabase = createClient();
  let query = supabase
    .from('professionals')
    .select('*, salon:salons(*)')
    .eq('is_active', true);

  if (options?.salonId) {
    query = query.eq('salon_id', options.salonId);
  }
  if (options?.offersHomeVisit !== undefined) {
    query = query.eq('offers_home_visit', options.offersHomeVisit);
  }

  const { data, error } = await query.order('display_name');
  if (error) throw error;
  return data as unknown as ProfessionalWithSalon[];
}

export async function getProfessionalById(id: string): Promise<ProfessionalWithSalon | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('professionals')
    .select('*, salon:salons(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as ProfessionalWithSalon;
}

export async function getServicesForProfessional(professionalId: string): Promise<Service[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('professional_services')
    .select('service_id, services(*)')
    .eq('professional_id', professionalId);

  if (error) throw error;
  return (data as unknown as ServiceRow[])
    .map((row) => row.services)
    .filter((s) => s.is_active);
}

export async function getActiveServices(): Promise<Service[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data as Service[];
}

export async function getProfessionalAvailability(professionalId: string): Promise<ProfessionalAvailability[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('professional_availability')
    .select('*')
    .eq('professional_id', professionalId)
    .order('day_of_week');

  if (error) throw error;
  return data as ProfessionalAvailability[];
}

export async function getAvailabilityOverrides(professionalId: string, startDate: string, endDate: string): Promise<AvailabilityOverride[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('availability_overrides')
    .select('*')
    .eq('professional_id', professionalId)
    .gte('override_date', startDate)
    .lte('override_date', endDate)
    .order('override_date');

  if (error) throw error;
  return data as AvailabilityOverride[];
}

export async function getBookedSlots(professionalId: string, date: string): Promise<Pick<Appointment, 'start_time' | 'end_time'>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('professional_id', professionalId)
    .eq('appointment_date', date)
    .in('status', ['pending', 'confirmed']);

  if (error) throw error;
  return data as Pick<Appointment, 'start_time' | 'end_time'>[];
}

export async function createAppointment(appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>, serviceIds: string[]): Promise<Appointment> {
  const supabase = createClient();

  const { data: appointmentData, error: appointmentError } = await supabase
    .from('appointments')
    .insert(appointment)
    .select()
    .single();

  if (appointmentError) throw appointmentError;

  const appointmentServices = serviceIds.map((serviceId) => ({
    appointment_id: (appointmentData as Appointment).id,
    service_id: serviceId,
  }));

  const { error: servicesError } = await supabase
    .from('appointment_services')
    .insert(appointmentServices);

  if (servicesError) throw servicesError;

  return appointmentData as Appointment;
}

function mapAppointmentDetails(row: Record<string, unknown>): AppointmentWithDetails {
  const services = (row.services as unknown as ServiceRow[]).map((s) => s.services);
  return {
    ...(row as unknown as Appointment),
    professional: (row.professional ?? null) as ProfessionalWithSalon | null,
    preferred_professional: (row.preferred_professional ?? null) as ProfessionalWithSalon | null,
    customer: row.customer as Profile,
    salon: (row.salon ?? null) as Salon | null,
    services,
  };
}

export async function getAppointmentWithDetails(appointmentId: string): Promise<AppointmentWithDetails | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      professional:professionals!appointments_professional_id_fkey(*, salon:salons(*)),
      preferred_professional:professionals!appointments_preferred_professional_id_fkey(*, salon:salons(*)),
      customer:profiles!appointments_customer_id_fkey(*),
      salon:salons(*),
      services:appointment_services(service_id, services(*))
    `)
    .eq('id', appointmentId)
    .single();

  if (error) throw error;
  return mapAppointmentDetails(data as Record<string, unknown>);
}

export async function getCustomerAppointments(customerId: string): Promise<AppointmentWithDetails[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      professional:professionals!appointments_professional_id_fkey(*, salon:salons(*)),
      preferred_professional:professionals!appointments_preferred_professional_id_fkey(*, salon:salons(*)),
      salon:salons(*),
      services:appointment_services(service_id, services(*))
    `)
    .eq('customer_id', customerId)
    .order('appointment_date', { ascending: false });

  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapAppointmentDetails);
}

export async function getPendingAppointments(): Promise<AppointmentWithDetails[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      professional:professionals!appointments_professional_id_fkey(*, salon:salons(*)),
      preferred_professional:professionals!appointments_preferred_professional_id_fkey(*, salon:salons(*)),
      customer:profiles!appointments_customer_id_fkey(*),
      salon:salons(*),
      services:appointment_services(service_id, services(*))
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapAppointmentDetails);
}

export async function assignProfessionalToAppointment(appointmentId: string, professionalId: string): Promise<Appointment> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('appointments')
    .update({ professional_id: professionalId })
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) throw error;
  return data as Appointment;
}

export async function updateAppointmentStatus(appointmentId: string, status: Appointment['status']): Promise<Appointment> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) throw error;
  return data as Appointment;
}