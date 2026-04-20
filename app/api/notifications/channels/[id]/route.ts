import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeChannelConfig } from '@/lib/notifications/sanitize';

const REQUIRED_FIELDS: Record<string, string[]> = {
  resend: ['api_key', 'from', 'to'],
  telegram_bot: ['bot_token', 'chat_id'],
  callmebot: ['phone', 'api_key'],
  whatsapp_cloud: ['access_token', 'phone_number_id', 'to', 'template_name', 'template_lang'],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { is_enabled, config, events } = body as {
    is_enabled?: boolean;
    config?: Record<string, unknown>;
    events?: string[];
  };

  const { data: existing, error: fetchError } = await supabase
    .from('notification_channels')
    .select('*')
    .eq('id', id)
    .eq('admin_id', user.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  let mergedConfig = existing.config as Record<string, unknown>;
  if (config) {
    mergedConfig = { ...mergedConfig };
    for (const [key, value] of Object.entries(config)) {
      if (value === '__set__') continue;
      if (typeof value === 'string' && !value.trim()) continue;
      mergedConfig[key] = value;
    }
  }

  const provider = existing.provider as string;
  const required = REQUIRED_FIELDS[provider];
  if (required) {
    const errors: string[] = [];
    for (const field of required) {
      const val = mergedConfig[field];
      if (!val || (typeof val === 'string' && !val.trim())) {
        errors.push(`${provider} requires "${field}"`);
      }
    }
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (is_enabled !== undefined) updateData.is_enabled = is_enabled;
  if (config !== undefined) updateData.config = mergedConfig;
  if (events !== undefined) updateData.events = events;

  const { data, error } = await supabase
    .from('notification_channels')
    .update(updateData)
    .eq('id', id)
    .eq('admin_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ channel: sanitizeChannelConfig(data) }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from('notification_channels')
    .delete()
    .eq('id', id)
    .eq('admin_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
