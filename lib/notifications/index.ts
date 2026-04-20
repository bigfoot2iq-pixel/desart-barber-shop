import type { NotificationEventType, NotificationChannelRow, DispatchResult, RenderedMessage, TelegramConfig, ResendConfig, CallMeBotConfig, WhatsAppCloudConfig } from './types';
import { createServiceClient } from '@/lib/supabase/service';
import type { AppointmentWithDetails } from '@/lib/types/database';
import { buildAppointmentCreatedMessage } from './templates/appointment-created';
import { buildAppointmentConfirmedMessage } from './templates/appointment-confirmed';
import { buildAppointmentCancelledMessage } from './templates/appointment-cancelled';
import { buildAppointmentCompletedMessage } from './templates/appointment-completed';
import { buildAppointmentAssignedMessage } from './templates/appointment-assigned';
import { sendTelegram } from './channels/telegram-bot';
import { sendEmail } from './channels/email-resend';
import { sendWhatsAppCallMeBot } from './channels/whatsapp-callmebot';
import { sendWhatsAppCloud } from './channels/whatsapp-cloud';

const TEMPLATE_MAP: Partial<Record<NotificationEventType, (apt: AppointmentWithDetails) => RenderedMessage>> = {
  'appointment.created': buildAppointmentCreatedMessage,
  'appointment.confirmed': buildAppointmentConfirmedMessage,
  'appointment.cancelled': buildAppointmentCancelledMessage,
  'appointment.completed': buildAppointmentCompletedMessage,
  'appointment.professional_assigned': buildAppointmentAssignedMessage,
};

export async function dispatchEvent(
  eventType: NotificationEventType,
  appointment: AppointmentWithDetails
): Promise<DispatchResult[]> {
  // intentional: notify every admin of every appointment event.
  // No per-admin scoping — all configured channels receive all events.
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
      const dedupKey = `${eventType}:${appointment.id}:${channel.id}`;

      const { error: insertError } = await supabase
        .from('notification_deliveries')
        .insert({
          appointment_id: appointment.id,
          event_type: eventType,
          channel_id: channel.id,
          status: 'pending',
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
        const message = TEMPLATE_MAP[eventType]?.(appointment);
        if (!message) {
          throw new Error(`No template for event type: ${eventType}`);
        }

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
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          } as never)
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
          .update({
            status: 'failed',
            last_error: errorMessage,
            attempt_count: 1,
          } as never)
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
