import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const REQUIRED_FIELDS: Record<string, string[]> = {
  resend: ['api_key', 'from', 'to'],
  telegram_bot: ['bot_token', 'chat_id'],
  callmebot: ['phone', 'api_key'],
  whatsapp_cloud: ['access_token', 'phone_number_id', 'to', 'template_name', 'template_lang'],
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('notification_channels')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ channels: data }, { status: 200 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { channel, provider, config, events } = body as {
    channel?: string;
    provider?: string;
    config?: Record<string, unknown>;
    events?: string[];
  };

  const errors: string[] = [];
  if (!channel || !['email', 'whatsapp', 'telegram'].includes(channel)) {
    errors.push('channel must be email, whatsapp, or telegram');
  }
  if (!provider) errors.push('provider is required');

  if (provider && config) {
    const required = REQUIRED_FIELDS[provider];
    if (required) {
      for (const field of required) {
        if (!config[field] || (typeof config[field] === 'string' && !(config[field] as string).trim())) {
          errors.push(`${provider} requires "${field}"`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('notification_channels')
    .insert({
      admin_id: user.id,
      channel,
      provider,
      config: config ?? {},
      events: events ?? ['appointment.created', 'appointment.cancelled', 'appointment.confirmed', 'appointment.completed', 'appointment.professional_assigned'],
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A channel for this admin/channel/provider combination already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ channel: data }, { status: 201 });
}
