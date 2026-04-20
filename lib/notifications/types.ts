import type { AppointmentWithDetails } from '@/lib/types/database';

export type NotificationEventType =
  | 'appointment.created'
  | 'appointment.cancelled'
  | 'appointment.confirmed'
  | 'appointment.completed'
  | 'appointment.professional_assigned';

export type ChannelKind = 'email' | 'whatsapp' | 'telegram';

export type ProviderName = 'resend' | 'whatsapp_cloud' | 'callmebot' | 'telegram_bot';

export interface RenderedMessage {
  subject: string;
  plainText: string;
  html: string;
  telegramHtml: string;
}

export interface DispatchResult {
  channelId: string;
  channel: ChannelKind;
  provider: ProviderName;
  status: 'sent' | 'failed';
  error?: string;
}

export interface NotificationChannelRow {
  id: string;
  admin_id: string;
  channel: ChannelKind;
  provider: ProviderName;
  is_enabled: boolean;
  config: Record<string, unknown>;
  events: NotificationEventType[];
  created_at: string;
  updated_at: string;
}

export interface ResendConfig {
  api_key: string;
  from: string;
  to: string;
}

export interface TelegramConfig {
  bot_token: string;
  chat_id: string;
}

export interface CallMeBotConfig {
  phone: string;
  api_key: string;
}

export interface WhatsAppCloudConfig {
  access_token: string;
  phone_number_id: string;
  to: string;
  template_name: string;
  template_lang: string;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return 'N/A';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }
  return phone;
}

export function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function maskSecret(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars) return '****';
  return value.slice(0, visibleChars) + '…' + '*'.repeat(Math.min(value.length - visibleChars, 8));
}
