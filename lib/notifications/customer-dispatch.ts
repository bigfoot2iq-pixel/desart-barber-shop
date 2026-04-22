import { createServiceClient } from '@/lib/supabase/service';
import type { AppointmentWithDetails } from '@/lib/types/database';
import type { NotificationEventType, CustomerNotificationSettings, CustomerDispatchResult } from './types';
import { CUSTOMER_TEMPLATE_MAP } from './templates/customer';
import { sendEmail } from './channels/email-resend';
import type { Locale } from '@/lib/i18n/config';

export async function dispatchCustomerEvent(
  eventType: NotificationEventType,
  appointment: AppointmentWithDetails,
  updatedAt: string
): Promise<CustomerDispatchResult | null> {
  const supabase = createServiceClient();

  const { data: settings, error: settingsError } = await supabase
    .from('customer_notification_settings')
    .select('*')
    .returns<CustomerNotificationSettings[]>()
    .limit(1)
    .maybeSingle();

  if (settingsError || !settings || !settings.is_enabled) {
    return null;
  }

  if (!settings.events.includes(eventType)) {
    return null;
  }

  const templateFn = CUSTOMER_TEMPLATE_MAP[eventType];
  if (!templateFn) {
    return null;
  }

  const customerEmail = appointment.customer?.email;
  if (!customerEmail) {
    const dedupKey = `customer:${eventType}:${appointment.id}:${updatedAt}`;
    const { error: insertError } = await supabase
      .from('notification_deliveries')
      .insert({
        appointment_id: appointment.id,
        event_type: eventType,
        channel_id: null,
        recipient_kind: 'customer',
        status: 'failed',
        attempt_count: 0,
        dedup_key: dedupKey,
        last_error: 'no_customer_email',
      } as never);

    if (insertError) {
      if (insertError.code === '23505') {
        return null;
      }
      console.error('[customer-dispatch] failed to log no_customer_email', insertError);
    }

    return {
      appointmentId: appointment.id,
      eventType,
      recipientKind: 'customer',
      status: 'failed',
      error: 'no_customer_email',
      dedupKey,
    };
  }

  const dedupKey = `customer:${eventType}:${appointment.id}:${updatedAt}`;

  const { data: delivery, error: insertError } = await supabase
    .from('notification_deliveries')
    .insert({
      appointment_id: appointment.id,
      event_type: eventType,
      channel_id: null,
      recipient_kind: 'customer',
      status: 'pending',
      attempt_count: 0,
      dedup_key: dedupKey,
    } as never)
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return null;
    }
    console.error('[customer-dispatch] failed to insert delivery row', insertError);
    return {
      appointmentId: appointment.id,
      eventType,
      recipientKind: 'customer',
      status: 'failed',
      error: insertError.message,
      dedupKey,
    };
  }

  try {
    const locale: Locale =
      appointment.customer?.locale === 'en' ? 'en' : 'fr';

    const message = await templateFn(appointment, locale);

    await sendEmail(
      { api_key: settings.resend_api_key, from: settings.from_address, to: customerEmail },
      message
    );

    await supabase
      .from('notification_deliveries')
      .update({ status: 'sent' as const, sent_at: new Date().toISOString() } as never)
      .eq('dedup_key', dedupKey);

    return {
      appointmentId: appointment.id,
      eventType,
      recipientKind: 'customer',
      status: 'sent',
      dedupKey,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await supabase
      .from('notification_deliveries')
      .update({ status: 'failed' as const, last_error: errorMessage, attempt_count: 1 } as never)
      .eq('dedup_key', dedupKey);

    return {
      appointmentId: appointment.id,
      eventType,
      recipientKind: 'customer',
      status: 'failed',
      error: errorMessage,
      dedupKey,
    };
  }
}
