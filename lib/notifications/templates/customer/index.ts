import type { NotificationEventType } from '../../types';
import type { AppointmentWithDetails } from '@/lib/types/database';
import type { RenderedMessage } from '../../types';
import type { Locale } from '@/lib/i18n/config';
import { buildCustomerAppointmentConfirmedMessage } from './customer-appointment-confirmed';
import { buildCustomerAppointmentCancelledMessage } from './customer-appointment-cancelled';

type TemplateFn = (apt: AppointmentWithDetails, locale: Locale) => Promise<RenderedMessage>;

export const CUSTOMER_TEMPLATE_MAP: Partial<Record<NotificationEventType, TemplateFn>> = {
  'appointment.confirmed': buildCustomerAppointmentConfirmedMessage,
  'appointment.cancelled': buildCustomerAppointmentCancelledMessage,
};
