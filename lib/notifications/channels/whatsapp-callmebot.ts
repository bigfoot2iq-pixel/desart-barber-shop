import type { CallMeBotConfig, RenderedMessage } from '../types';

export async function sendWhatsAppCallMeBot(config: CallMeBotConfig, message: RenderedMessage): Promise<void> {
  const params = new URLSearchParams({
    phone: config.phone,
    text: message.plainText,
    apikey: config.api_key,
  });

  const url = `https://api.callmebot.com/whatsapp.php?${params.toString()}`;

  const res = await fetch(url, { method: 'GET' });

  if (!res.ok) {
    throw new Error(`CallMeBot API error: ${res.status}`);
  }

  const body = await res.text();
  if (body.includes('ERROR')) {
    throw new Error(`CallMeBot returned error: ${body}`);
  }
}
