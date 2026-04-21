import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/notifications/channels/email-resend';

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { to } = body as { to?: string };
  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'Valid "to" email is required' }, { status: 400 });
  }

  const serviceSupabase = createServiceClient();

  const { data: settings, error } = await serviceSupabase
    .from('customer_notification_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error || !settings) {
    return NextResponse.json({ error: 'Customer notification settings not configured' }, { status: 400 });
  }

  if (!settings.is_enabled) {
    return NextResponse.json({ error: 'Customer notifications are disabled' }, { status: 400 });
  }

  try {
    await sendEmail(
      { api_key: settings.resend_api_key, from: settings.from_address, to },
      {
        subject: 'Test email from DesArt',
        plainText: 'This is a test from DesArt. If you received this, your customer email notifications are working.',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
            <div style="background: #ffffff; border-radius: 8px; padding: 32px 24px; border: 1px solid #e0e0e0; border-left: 4px solid #3b82f6;">
              <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 22px;">Test email</h2>
              <p style="margin: 0; color: #555; font-size: 15px;">This is a test from DesArt. If you received this, your customer email notifications are working.</p>
            </div>
          </div>
        `,
        telegramHtml: '',
        whatsAppCloudParams: [],
      }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
