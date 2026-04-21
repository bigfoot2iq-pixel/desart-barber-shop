import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { CustomerNotificationSettings } from '@/lib/notifications/types';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const serviceSupabase = createServiceClient();

  const { data: settings, error } = await serviceSupabase
    .from('customer_notification_settings')
    .select('*')
    .returns<CustomerNotificationSettings[]>()
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[customer-settings] fetch error', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }

  if (!settings) {
    return NextResponse.json({ settings: null }, { status: 200 });
  }

  return NextResponse.json({
    settings: {
      id: settings.id,
      is_enabled: settings.is_enabled,
      from_address: settings.from_address,
      events: settings.events,
      has_api_key: !!settings.resend_api_key,
      created_at: settings.created_at,
      updated_at: settings.updated_at,
    },
  }, { status: 200 });
}

export async function PUT(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { is_enabled, resend_api_key, from_address, events } = body as {
    is_enabled?: boolean;
    resend_api_key?: string;
    from_address?: string;
    events?: string[];
  };

  const errors: string[] = [];
  if (from_address !== undefined && !from_address.trim()) {
    errors.push('from_address is required');
  }
  if (resend_api_key !== undefined && (!resend_api_key || resend_api_key.length < 10)) {
    errors.push('resend_api_key must be at least 10 characters');
  }
  if (events !== undefined) {
    const validEvents = ['appointment.confirmed', 'appointment.cancelled'];
    for (const e of events) {
      if (!validEvents.includes(e)) {
        errors.push(`invalid event: ${e}`);
      }
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
  }

  const serviceSupabase = createServiceClient();

  const { data: existing } = await serviceSupabase
    .from('customer_notification_settings')
    .select('id, resend_api_key')
    .returns<CustomerNotificationSettings[]>()
    .limit(1)
    .maybeSingle();

  const updates: Record<string, unknown> = {};
  if (is_enabled !== undefined) updates.is_enabled = is_enabled;
  if (from_address !== undefined) updates.from_address = from_address;
  if (events !== undefined) updates.events = events;
  if (resend_api_key !== undefined) {
    updates.resend_api_key = resend_api_key;
  } else if (existing?.resend_api_key) {
    updates.resend_api_key = existing.resend_api_key;
  }

  if (existing) {
    const { error: updateError } = await serviceSupabase
      .from('customer_notification_settings')
      .update(updates as never)
      .eq('id', existing.id);

    if (updateError) {
      console.error('[customer-settings] update error', updateError);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
  } else {
    if (!updates.resend_api_key) {
      return NextResponse.json({ error: 'resend_api_key is required for first setup' }, { status: 400 });
    }
    const { error: insertError } = await serviceSupabase
      .from('customer_notification_settings')
      .insert(updates as never);

    if (insertError) {
      console.error('[customer-settings] insert error', insertError);
      return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
