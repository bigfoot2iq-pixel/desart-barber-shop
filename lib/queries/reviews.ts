import { createClient } from '@/lib/supabase/client';
import type { AppointmentReview } from '@/lib/types/database';

export async function createReview({
  appointment_id,
  customer_id,
  professional_id,
  rating,
  comment,
}: {
  appointment_id: string;
  customer_id: string;
  professional_id: string | null;
  rating: number;
  comment: string | null;
}): Promise<AppointmentReview> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('appointment_reviews')
    .insert({ appointment_id, customer_id, professional_id, rating, comment })
    .select()
    .single();

  if (error) throw error;
  return data as AppointmentReview;
}

export async function getReviewsForAppointments(ids: string[]): Promise<AppointmentReview[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('appointment_reviews')
    .select('*')
    .in('appointment_id', ids);

  if (error) throw error;
  return data as AppointmentReview[];
}
