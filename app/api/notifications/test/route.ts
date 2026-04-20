import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { RenderedMessage, TelegramConfig, ResendConfig, CallMeBotConfig, WhatsAppCloudConfig } from '@/lib/notifications/types';
import { sendTelegram } from '@/lib/notifications/channels/telegram-bot';
import { sendEmail } from '@/lib/notifications/channels/email-resend';
import { sendWhatsAppCallMeBot } from '@/lib/notifications/channels/whatsapp-callmebot';
import { sendWhatsAppCloud } from '@/lib/notifications/channels/whatsapp-cloud';

const TEST_MESSAGE: RenderedMessage = {
  subject: 'DesArt Notification Test',
  plainText: 'This is a test message from DesArt Barber Shop. If you received this, your notification channel is configured correctly.',
  html: '<div style="font-family: sans-serif; padding: 24px;"><h2>DesArt Notification Test</h2><p>If you received this, your notification channel is configured correctly.</p></div>',
  telegramHtml: '<b>DesArt Notification Test</b>\nIf you received this, your notification channel is configured correctly.',
};

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

  const { channel_id } = body as { channel_id?: string };
  if (!channel_id) {
    return NextResponse.json({ error: 'channel_id is required' }, { status: 400 });
  }

  const serviceSupabase = createServiceClient();

  const { data: channel, error: fetchError } = await serviceSupabase
    .from('notification_channels')
    .select('*')
    .eq('id', channel_id)
    .eq('admin_id', user.id)
    .single()
    .returns<Array<{ provider: string; config: Record<string, unknown> }>>();

  if (fetchError || !channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  const ch = channel as unknown as { provider: string; config: Record<string, unknown> };

  try {
    switch (ch.provider) {
      case 'telegram_bot':
        await sendTelegram(ch.config as unknown as TelegramConfig, TEST_MESSAGE);
        break;
      case 'resend':
        await sendEmail(ch.config as unknown as ResendConfig, TEST_MESSAGE);
        break;
      case 'callmebot':
        await sendWhatsAppCallMeBot(ch.config as unknown as CallMeBotConfig, TEST_MESSAGE);
        break;
      case 'whatsapp_cloud':
        await sendWhatsAppCloud(ch.config as unknown as WhatsAppCloudConfig, TEST_MESSAGE);
        break;
      default:
        return NextResponse.json({ error: `Unsupported provider: ${ch.provider}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: 'Test sent successfully' }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
