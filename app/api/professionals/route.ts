import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  console.log('[professionals] auth.getUser:', { userId: user?.id, error: userError?.message });

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  console.log('[professionals] profile lookup:', { profile, error: profileError?.message });

  const role = profile?.role ?? user.app_metadata?.role;
  console.log('[professionals] resolved role:', role);

  if (role !== 'admin') {
    console.log('[professionals] 403: not admin, role =', role);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!profile) {
    console.log('[professionals] creating missing admin profile row');
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        role: 'admin',
        email: user.email,
      });

    if (insertError) {
      console.log('[professionals] failed to create admin profile:', insertError.message);
    }
  }

  const body = await request.json();
  const { display_name, phone, years_of_experience, profession, profile_image_url, offers_home_visit, is_active } = body;

  const errors: string[] = [];
  if (!display_name?.trim()) errors.push('display_name is required');
  if (!phone?.trim()) errors.push('phone is required');

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
  }

  const professionalId = crypto.randomUUID();

  const { data: professional, error: profError } = await supabase
    .from('professionals')
    .insert({
      id: professionalId,
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

  console.log('[professionals] professional insert result:', { data: professional, error: profError?.message });
  if (profError) {
    return NextResponse.json({ error: profError.message }, { status: 500 });
  }

  return NextResponse.json({ professional }, { status: 201 });
}