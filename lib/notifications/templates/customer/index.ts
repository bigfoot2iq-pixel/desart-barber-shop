import type { NotificationEventType } from '../../types';
import type { AppointmentWithDetails } from '@/lib/types/database';
import type { RenderedMessage } from '../../types';
import { buildCustomerAppointmentConfirmedMessage } from './customer-appointment-confirmed';
import { buildCustomerAppointmentCancelledMessage } from './customer-appointment-cancelled';

export const CUSTOMER_TEMPLATE_MAP: Partial<Record<NotificationEventType, (apt: AppointmentWithDetails) => RenderedMessage>> = {
  'appointment.confirmed': buildCustomerAppointmentConfirmedMessage,
  'appointment.cancelled': buildCustomerAppointmentCancelledMessage,
};
