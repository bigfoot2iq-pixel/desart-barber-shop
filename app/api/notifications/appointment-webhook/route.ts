import { NextResponse } from 'next/server';
import { dispatchEvent } from '@/lib/notifications';
import { dispatchCustomerEvent } from '@/lib/notifications/customer-dispatch';
import { getAppointmentWithDetailsService } from '@/lib/notifications/queries';
import type { NotificationEventType } from '@/lib/notifications/types';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

function deriveEventTypes(payload: SupabaseWebhookPayload): NotificationEventType[] {
  const { type, record, old_record } = payload;

  if (!record) return [];

  const events: NotificationEventType[] = [];

  if (type === 'INSERT' && record.status === 'pending') {
    events.push('appointment.created');
  }

  if (type === 'UPDATE' && old_record && record.status !== old_record.status) {
    const newStatus = record.status as string;
    if (newStatus === 'confirmed') events.push('appointment.confirmed');
    if (newStatus === 'cancelled') events.push('appointment.cancelled');
    if (newStatus === 'completed') events.push('appointment.completed');
  }

  if (
    type === 'UPDATE' &&
    old_record &&
    old_record.professional_id !== record.professional_id &&
    record.professional_id !== null
  ) {
    events.push('appointment.professional_assigned');
  }

  return events;
}

async function checkActorIsStaff(updatedBy: string | null): Promise<boolean> {
  if (!updatedBy) {
    console.log('[webhook] checkActorIsStaff: no updatedBy provided, returning false');
    return false;
  }

  console.log('[webhook] checkActorIsStaff: looking up profile for updatedBy=', updatedBy);

  const supabase = createServiceClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', updatedBy)
    .single() as { data: { role: string } | null; error: unknown };

  if (error) {
    console.error('[webhook] checkActorIsStaff: error fetching profile', error);
    return false;
  }

  const isStaff = profile?.role === 'admin' || profile?.role === 'professional';
  console.log('[webhook] checkActorIsStaff: profile found', { role: profile?.role, isStaff });

  return isStaff;
}

export async function POST(request: Request) {
  const secret = process.env.NOTIFICATIONS_WEBHOOK_SECRET;
  const providedSecret = request.headers.get('x-webhook-secret');

  console.log('[webhook] received request', {
    hasSecret: !!secret,
    hasProvidedSecret: !!providedSecret,
    secretsMatch: secret === providedSecret,
    url: request.url,
    timestamp: new Date().toISOString(),
  });

  if (!secret || providedSecret !== secret) {
    console.error('[webhook] unauthorized: secret mismatch');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    console.error('[webhook] invalid JSON body');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('[webhook] payload received', {
    type: payload.type,
    table: payload.table,
    schema: payload.schema,
    hasRecord: !!payload.record,
    hasOldRecord: !!payload.old_record,
    recordId: payload.record?.id,
    recordStatus: payload.record?.status,
    oldRecordStatus: payload.old_record?.status,
    recordUpdatedBy: payload.record?.updated_by,
    recordCustomerId: payload.record?.customer_id,
    recordUpdatedAt: payload.record?.updated_at,
    recordProfessionalId: payload.record?.professional_id,
    oldRecordProfessionalId: payload.old_record?.professional_id,
  });

  if (payload.table !== 'appointments' || payload.schema !== 'public') {
    console.log('[webhook] ignoring: not appointments table');
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const eventTypes = deriveEventTypes(payload);
  console.log('[webhook] derived event types', { eventTypes });

  if (eventTypes.length === 0 || !payload.record?.id) {
    console.log('[webhook] no matching events or missing record id');
    return NextResponse.json({ ok: true, reason: 'no_matching_event' }, { status: 200 });
  }

  try {
    const appointment = await getAppointmentWithDetailsService(payload.record.id as string);
    if (!appointment) {
      console.log('[webhook] appointment not found', { id: payload.record.id });
      return NextResponse.json({ ok: true, reason: 'appointment_not_found' }, { status: 200 });
    }

    console.log('[webhook] appointment loaded', {
      appointmentId: appointment.id,
      status: appointment.status,
      customerId: appointment.customer?.id,
      customerEmail: appointment.customer?.email,
      customerFirstName: appointment.customer?.first_name,
      customerRole: appointment.customer?.role,
      professionalId: appointment.professional?.id,
      hasServices: appointment.services?.length,
    });

    if (payload.type === 'UPDATE' && !payload.record.updated_at) {
      console.log('[webhook] missing updated_at for UPDATE');
      return NextResponse.json({ ok: true, reason: 'missing_updated_at' }, { status: 200 });
    }
    if (payload.type === 'INSERT' && !payload.record.created_at && !payload.record.updated_at) {
      console.log('[webhook] missing timestamp for INSERT');
      return NextResponse.json({ ok: true, reason: 'missing_timestamp' }, { status: 200 });
    }

    const allResults: Awaited<ReturnType<typeof dispatchEvent>>[] = [];
    const CUSTOMER_EVENT_TYPES: NotificationEventType[] = [
      'appointment.confirmed',
      'appointment.cancelled',
    ];

    const updatedAt = String(payload.record.updated_at);
    console.log('[webhook] dispatching admin notifications', { eventTypes, updatedAt });

    for (const eventType of eventTypes) {
      console.log('[webhook] dispatching admin event', { eventType });
      const results = await dispatchEvent(eventType, appointment, updatedAt);
      console.log('[webhook] admin event result', { eventType, results });
      allResults.push(results);
    }

    const updatedBy = payload.record.updated_by as string | null;
    const customerId = payload.record.customer_id as string | null;
    console.log('[webhook] actor analysis', {
      updatedBy,
      customerId,
      updatedByIsNull: !updatedBy,
      customerIdIsNull: !customerId,
      updatedByEqualsCustomerId: updatedBy === customerId,
    });

    const actorIsStaff = await checkActorIsStaff(updatedBy);

    console.log('[webhook] customer email decision', {
      updatedBy,
      customerId,
      actorIsStaff,
      eventTypes,
      customerEventTypes: CUSTOMER_EVENT_TYPES,
    });

    const customerResults: (Awaited<ReturnType<typeof dispatchCustomerEvent>>)[] = [];
    for (const eventType of eventTypes) {
      console.log('[webhook] evaluating customer event', { eventType });

      if (!CUSTOMER_EVENT_TYPES.includes(eventType)) {
        console.log('[webhook] skipping customer event: not in customer event types', { eventType });
        continue;
      }

      const isConfirmation = eventType === 'appointment.confirmed';
      const shouldSendForEvent = isConfirmation || actorIsStaff;

      console.log('[webhook] customer event evaluation', {
        eventType,
        isConfirmation,
        actorIsStaff,
        shouldSendForEvent,
      });

      if (shouldSendForEvent) {
        console.log('[webhook] calling dispatchCustomerEvent', { eventType, appointmentId: appointment.id });
        const result = await dispatchCustomerEvent(eventType, appointment, updatedAt);
        console.log('[webhook] dispatchCustomerEvent result', { eventType, result });
        customerResults.push(result);
      } else {
        console.log('[webhook] skipping customer event: shouldSendForEvent is false', { eventType });
      }
    }

    const flatResults = allResults.flat();
    const dispatched = flatResults.filter((r) => r.status === 'sent').length;

    console.log('[webhook] completed', {
      dispatched,
      adminResultsCount: flatResults.length,
      customerResultsCount: customerResults.length,
      customerResults,
    });

    return NextResponse.json({ ok: true, dispatched, results: flatResults, customerResults }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[webhook] dispatch error', { error: errorMessage, stack: err instanceof Error ? err.stack : undefined });
    return NextResponse.json({ ok: true, error: 'dispatch_failed', details: errorMessage }, { status: 200 });
  }
}
