import { createClient } from '@/lib/supabase/client';
import type { Profile, Professional, Salon } from '@/lib/types/database';

type ProfessionalWithSalon = Professional & { salon: Salon };

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
  const supabase = createClient();
  const { id, ...updates } = profile;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function getProfessionalProfile(userId: string): Promise<ProfessionalWithSalon | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('professionals')
    .select('*, salon:salons(*)')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data as unknown as ProfessionalWithSalon;
}

export async function updateProfessionalProfile(userId: string, updates: Partial<Professional>): Promise<Professional> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('professionals')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as Professional;
}