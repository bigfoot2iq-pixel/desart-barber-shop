import { createServiceClient } from '@/lib/supabase/service';
import type { AppointmentWithDetails, Service, Professional, Salon, Profile } from '@/lib/types/database';

type ServiceRow = { service_id: string; services: Service };
type ProfessionalWithSalon = Professional & { salon: Salon };

function mapAppointmentDetails(row: Record<string, unknown>): AppointmentWithDetails {
  const services = (row.services as unknown as ServiceRow[]).map((s) => s.services);
  return {
    ...(row as unknown as AppointmentWithDetails),
    professional: (row.professional ?? null) as ProfessionalWithSalon | null,
    preferred_professional: (row.preferred_professional ?? null) as ProfessionalWithSalon | null,
    customer: row.customer as Profile,
    salon: (row.salon ?? null) as Salon | null,
    services,
  };
}

export async function getAppointmentWithDetailsService(appointmentId: string): Promise<AppointmentWithDetails | null> {
  const supabase = createServiceClient();
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
