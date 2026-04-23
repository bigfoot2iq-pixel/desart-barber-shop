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

  console.log('[customer-dispatch] starting', { eventType, appointmentId: appointment.id });

  const { data: settings, error: settingsError } = await supabase
    .from('customer_notification_settings')
    .select('*')
    .returns<CustomerNotificationSettings[]>()
    .limit(1)
    .maybeSingle();

  if (settingsError || !settings || !settings.is_enabled) {
    console.log('[customer-dispatch] settings disabled or missing', { settingsError, hasSettings: !!settings, isEnabled: settings?.is_enabled });
    return null;
  }

  if (!settings.events.includes(eventType)) {
    console.log('[customer-dispatch] event not in settings', { eventType, configuredEvents: settings.events });
    return null;
  }

  const templateFn = CUSTOMER_TEMPLATE_MAP[eventType];
  if (!templateFn) {
    console.log('[customer-dispatch] no template function found for event', { eventType });
    return null;
  }

  console.log('[customer-dispatch] settings loaded', {
    isEnabled: settings.is_enabled,
    fromAddress: settings.from_address,
    events: settings.events,
    hasApiKey: !!settings.resend_api_key,
    apiKeyPrefix: settings.resend_api_key ? settings.resend_api_key.substring(0, 8) + '...' : null,
  });

  const customerEmail = appointment.customer?.email;
  if (!customerEmail) {
    console.log('[customer-dispatch] no customer email', { customerId: appointment.customer?.id });
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
  console.log('[customer-dispatch] dedupKey', { dedupKey });

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
      console.log('[customer-dispatch] duplicate dedupKey, skipping', { dedupKey });
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

  console.log('[customer-dispatch] delivery row inserted', { deliveryId: (delivery as { id?: string } | null)?.id });

  try {
    const locale: Locale =
      appointment.customer?.locale === 'en' ? 'en' : 'fr';

    console.log('[customer-dispatch] building email message', { to: customerEmail, eventType, locale });

    const message = await templateFn(appointment, locale);

    console.log('[customer-dispatch] message built, calling sendEmail', {
      to: customerEmail,
      from: settings.from_address,
      subject: message.subject,
      plainTextLength: message.plainText?.length,
      htmlLength: message.html?.length,
    });

    await sendEmail(
      { api_key: settings.resend_api_key, from: settings.from_address, to: customerEmail },
      message
    );

    console.log('[customer-dispatch] email sent successfully', { to: customerEmail });

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
