import type { TelegramConfig, RenderedMessage } from '../types';

export async function sendTelegram(config: TelegramConfig, message: RenderedMessage): Promise<void> {
  const url = `https://api.telegram.org/bot${config.bot_token}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chat_id,
      text: message.telegramHtml,
      parse_mode: 'HTML',
    }),
  });

  const data = await res.json() as { ok: boolean; description?: string };

  if (!res.ok || !data.ok) {
    throw new Error(`Telegram API error: ${data.description ?? res.statusText}`);
  }
}
