import type { ResendConfig, RenderedMessage } from '../types';

export async function sendEmail(config: ResendConfig, message: RenderedMessage): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [config.to],
      subject: message.subject,
      html: message.html,
      text: message.plainText,
    }),
  });

  if (res.status === 429) {
    throw new Error('rate_limited');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error: ${res.status} ${body}`);
  }
}
