import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { RenderedMessage, TelegramConfig, ResendConfig, CallMeBotConfig, WhatsAppCloudConfig } from '@/lib/notifications/types';
import { sendTelegram } from '@/lib/notifications/channels/telegram-bot';
import { sendEmail } from '@/lib/notifications/channels/email-resend';
import { sendWhatsAppCallMeBot } from '@/lib/notifications/channels/whatsapp-callmebot';
import { sendWhatsAppCloud } from '@/lib/notifications/channels/whatsapp-cloud';
import { getAppointmentWithDetailsService } from '@/lib/queries/notifications';

async function loadTemplateBuilder(eventType: string, appointment: Awaited<ReturnType<typeof getAppointmentWithDetailsService>>) {
  if (!appointment) throw new Error('Appointment not found');

  switch (eventType) {
    case 'appointment.created': {
      const { buildAppointmentCreatedMessage } = await import('@/lib/notifications/templates/appointment-created');
      return buildAppointmentCreatedMessage(appointment);
    }
    case 'appointment.confirmed': {
      const { buildAppointmentConfirmedMessage } = await import('@/lib/notifications/templates/appointment-confirmed');
      return buildAppointmentConfirmedMessage(appointment);
    }
    case 'appointment.cancelled': {
      const { buildAppointmentCancelledMessage } = await import('@/lib/notifications/templates/appointment-cancelled');
      return buildAppointmentCancelledMessage(appointment);
    }
    case 'appointment.completed': {
      const { buildAppointmentCompletedMessage } = await import('@/lib/notifications/templates/appointment-completed');
      return buildAppointmentCompletedMessage(appointment);
    }
    case 'appointment.professional_assigned': {
      const { buildAppointmentAssignedMessage } = await import('@/lib/notifications/templates/appointment-assigned');
      return buildAppointmentAssignedMessage(appointment);
    }
    default:
      throw new Error(`Unknown event type: ${eventType}`);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const serviceSupabase = createServiceClient();

  const { data: delivery, error: fetchError } = await serviceSupabase
    .from('notification_deliveries')
    .select('*, channel:notification_channels(*)')
    .eq('id', id)
    .single() as { data: Record<string, unknown> | null; error: unknown };

  if (fetchError || !delivery) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  }

  if (delivery.status !== 'failed') {
    return NextResponse.json({ error: 'Can only retry failed deliveries' }, { status: 400 });
  }

  const channel = delivery.channel as Record<string, unknown> | null;
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found for this delivery' }, { status: 400 });
  }

  try {
    const appointment = await getAppointmentWithDetailsService(delivery.appointment_id as string);
    const message = await loadTemplateBuilder(delivery.event_type as string, appointment);

    switch (channel.provider) {
      case 'telegram_bot':
        await sendTelegram(channel.config as unknown as TelegramConfig, message);
        break;
      case 'resend':
        await sendEmail(channel.config as unknown as ResendConfig, message);
        break;
      case 'callmebot':
        await sendWhatsAppCallMeBot(channel.config as unknown as CallMeBotConfig, message);
        break;
      case 'whatsapp_cloud':
        await sendWhatsAppCloud(channel.config as unknown as WhatsAppCloudConfig, message);
        break;
      default:
        throw new Error(`Unsupported provider: ${channel.provider}`);
    }

    await serviceSupabase
      .from('notification_deliveries')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        attempt_count: (delivery.attempt_count as number) + 1,
        last_error: null,
      } as never)
      .eq('id', id);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await serviceSupabase
      .from('notification_deliveries')
      .update({
        last_error: errorMessage,
        attempt_count: (delivery.attempt_count as number) + 1,
      } as never)
      .eq('id', id);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
