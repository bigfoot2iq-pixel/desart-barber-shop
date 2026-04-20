import { NextResponse } from 'next/server';
import { dispatchEvent } from '@/lib/notifications';
import { getAppointmentWithDetailsService } from '@/lib/notifications/queries';
import type { NotificationEventType } from '@/lib/notifications/types';

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

export async function POST(request: Request) {
  const secret = process.env.NOTIFICATIONS_WEBHOOK_SECRET;
  const providedSecret = request.headers.get('x-webhook-secret');

  if (!secret || providedSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload.table !== 'appointments' || payload.schema !== 'public') {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const eventTypes = deriveEventTypes(payload);
  if (eventTypes.length === 0 || !payload.record?.id) {
    return NextResponse.json({ ok: true, reason: 'no_matching_event' }, { status: 200 });
  }

  try {
    const appointment = await getAppointmentWithDetailsService(payload.record.id as string);
    if (!appointment) {
      return NextResponse.json({ ok: true, reason: 'appointment_not_found' }, { status: 200 });
    }

    const allResults: Awaited<ReturnType<typeof dispatchEvent>>[] = [];
    const updatedAt = String(payload.record.updated_at ?? new Date().toISOString());
    for (const eventType of eventTypes) {
      const results = await dispatchEvent(eventType, appointment, updatedAt);
      allResults.push(results);
    }

    const flatResults = allResults.flat();
    const dispatched = flatResults.filter((r) => r.status === 'sent').length;

    return NextResponse.json({ ok: true, dispatched, results: flatResults }, { status: 200 });
  } catch (err) {
    console.error('[webhook] dispatch error', err);
    return NextResponse.json({ ok: true, error: 'dispatch_failed' }, { status: 200 });
  }
}
