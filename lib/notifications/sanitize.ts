export const SECRET_FIELDS: Record<string, string[]> = {
  resend: ['api_key'],
  telegram_bot: ['bot_token'],
  callmebot: ['api_key'],
  whatsapp_cloud: ['access_token'],
};

export function sanitizeChannelConfig(channel: Record<string, unknown>): Record<string, unknown> {
  const provider = channel.provider as string;
  const config = channel.config as Record<string, unknown> | undefined;
  if (!config || !provider) return channel;

  const secrets = SECRET_FIELDS[provider] ?? [];
  const sanitized = { ...channel };
  sanitized.config = { ...config };
  for (const field of secrets) {
    if (field in (sanitized.config as Record<string, unknown>)) {
      (sanitized.config as Record<string, unknown>)[field] = '__set__';
    }
  }
  return sanitized;
}
