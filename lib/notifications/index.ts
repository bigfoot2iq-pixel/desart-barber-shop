import type { NotificationEventType, NotificationChannelRow, DispatchResult, RenderedMessage, TelegramConfig, ResendConfig, CallMeBotConfig, WhatsAppCloudConfig, ChannelKind } from './types';
import { createServiceClient } from '@/lib/supabase/service';
import type { AppointmentWithDetails } from '@/lib/types/database';
import { TEMPLATE_MAP } from './templates';
import { sendTelegram } from './channels/telegram-bot';
import { sendEmail } from './channels/email-resend';
import { sendWhatsAppCallMeBot } from './channels/whatsapp-callmebot';
import { sendWhatsAppCloud } from './channels/whatsapp-cloud';
import type { Locale } from '@/lib/i18n/config';

async function resolveAdminLocale(adminId: string, channel: ChannelKind): Promise<Locale> {
  if (channel === 'telegram') {
    return 'fr';
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('profiles')
    .select('locale')
    .eq('id', adminId)
    .single() as { data: { locale: string } | null; error: unknown };

  return (data?.locale as Locale) ?? 'fr';
}

export async function dispatchEvent(
  eventType: NotificationEventType,
  appointment: AppointmentWithDetails,
  updatedAt: string
): Promise<DispatchResult[]> {
  const supabase = createServiceClient();

  const { data: channels, error: channelsError } = await supabase
    .from('notification_channels')
    .select('*')
    .eq('is_enabled', true)
    .returns<NotificationChannelRow[]>();

  if (channelsError) {
    console.error('[notifications] failed to load channels', channelsError);
    return [];
  }

  const eligible = channels.filter((ch) => ch.events.includes(eventType));

  if (eligible.length === 0) return [];

  const results: DispatchResult[] = [];

  await Promise.allSettled(
    eligible.map(async (channel) => {
      const dedupKey = `${eventType}:${appointment.id}:${channel.id}:${updatedAt}`;

      const { error: insertError } = await supabase
        .from('notification_deliveries')
        .insert({
          appointment_id: appointment.id,
          event_type: eventType,
          channel_id: channel.id,
          status: 'pending' as const,
          attempt_count: 0,
          dedup_key: dedupKey,
        } as never);

      if (insertError) {
        if (insertError.code === '23505') {
          return;
        }
        results.push({
          channelId: channel.id,
          channel: channel.channel,
          provider: channel.provider,
          status: 'failed',
          error: insertError.message,
        });
        return;
      }

      try {
        const locale = await resolveAdminLocale(channel.admin_id, channel.channel);
        const message = await TEMPLATE_MAP[eventType](appointment, locale);

        if (channel.provider === 'telegram_bot') {
          await sendTelegram(channel.config as unknown as TelegramConfig, message);
        } else if (channel.provider === 'resend') {
          await sendEmail(channel.config as unknown as ResendConfig, message);
        } else if (channel.provider === 'callmebot') {
          await sendWhatsAppCallMeBot(channel.config as unknown as CallMeBotConfig, message);
        } else if (channel.provider === 'whatsapp_cloud') {
          await sendWhatsAppCloud(channel.config as unknown as WhatsAppCloudConfig, message);
        }

        await supabase
          .from('notification_deliveries')
          .update({ status: 'sent' as const, sent_at: new Date().toISOString() } as never)
          .eq('dedup_key', dedupKey);

        results.push({
          channelId: channel.id,
          channel: channel.channel,
          provider: channel.provider,
          status: 'sent',
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        await supabase
          .from('notification_deliveries')
          .update({ status: 'failed' as const, last_error: errorMessage, attempt_count: 1 } as never)
          .eq('dedup_key', dedupKey);

        results.push({
          channelId: channel.id,
          channel: channel.channel,
          provider: channel.provider,
          status: 'failed',
          error: errorMessage,
        });
      }
    })
  );

  return results;
}
