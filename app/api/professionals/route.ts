import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use JWT-signed app_metadata.role only — profiles.role is user-writable
  // via RLS and should not be treated as an authorization source.
  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    display_name,
    phone,
    years_of_experience,
    profession,
    profile_image_url,
    offers_home_visit,
    is_active,
    salon_id,
  } = body as {
    display_name?: string;
    phone?: string;
    years_of_experience?: number;
    profession?: string;
    profile_image_url?: string | null;
    offers_home_visit?: boolean;
    is_active?: boolean;
    salon_id?: string;
  };

  const errors: string[] = [];
  if (!display_name?.trim()) errors.push('display_name is required');
  if (!phone?.trim()) errors.push('phone is required');
  if (typeof years_of_experience === 'number' && years_of_experience < 0) {
    errors.push('years_of_experience must be >= 0');
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
  }

  const professionalId = crypto.randomUUID();

  const { data: professional, error: profError } = await supabase
    .from('professionals')
    .insert({
      id: professionalId,
      salon_id: salon_id ?? null,
      display_name,
      phone,
      years_of_experience: years_of_experience ?? 0,
      profession: profession ?? 'barber',
      profile_image_url: profile_image_url || null,
      offers_home_visit: offers_home_visit ?? false,
      is_active: is_active ?? true,
    })
    .select()
    .single();

  if (profError) {
    console.error('[professionals] insert failed', profError);
    return NextResponse.json(
      { error: 'Failed to create professional' },
      { status: 500 }
    );
  }

  const defaultAvailability = [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({
    id: crypto.randomUUID(),
    professional_id: professionalId,
    day_of_week: dayOfWeek,
    start_time: '09:00:00',
    end_time: '17:00:00',
    is_available: dayOfWeek !== 0,
  }));

  const { error: availError } = await supabase
    .from('professional_availability')
    .insert(defaultAvailability);

  if (availError) {
    console.error('[professionals] default availability insert failed', availError);
  }

  return NextResponse.json({ professional }, { status: 201 });
}
