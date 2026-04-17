import { createClient } from '@/lib/supabase/client';
import type { ProfessionalAvailability, AvailabilityOverride } from '@/lib/types/database';

export async function getWeeklySchedule(professionalId: string): Promise<ProfessionalAvailability[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('professional_availability')
    .select('*')
    .eq('professional_id', professionalId)
    .order('day_of_week');

  if (error) throw error;
  return data;
}

export async function setWeeklySchedule(professionalId: string, schedule: Omit<ProfessionalAvailability, 'id'>[]): Promise<ProfessionalAvailability[]> {
  const supabase = createClient();

  await supabase
    .from('professional_availability')
    .delete()
    .eq('professional_id', professionalId);

  const { data, error } = await supabase
    .from('professional_availability')
    .insert(schedule)
    .select();

  if (error) throw error;
  return data;
}

export async function getOverrides(professionalId: string, startDate: string, endDate: string): Promise<AvailabilityOverride[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('availability_overrides')
    .select('*')
    .eq('professional_id', professionalId)
    .gte('override_date', startDate)
    .lte('override_date', endDate)
    .order('override_date');

  if (error) throw error;
  return data;
}

export async function addOverride(override: Omit<AvailabilityOverride, 'id'>): Promise<AvailabilityOverride> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('availability_overrides')
    .insert(override)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOverride(overrideId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('availability_overrides')
    .delete()
    .eq('id', overrideId);

  if (error) throw error;
}