import type { NotificationEventType, RenderedMessage } from '../types';
import type { AppointmentWithDetails } from '@/lib/types/database';
import type { Locale } from '@/lib/i18n/config';
import { buildAppointmentCreatedMessage } from './appointment-created';
import { buildAppointmentConfirmedMessage } from './appointment-confirmed';
import { buildAppointmentCancelledMessage } from './appointment-cancelled';
import { buildAppointmentCompletedMessage } from './appointment-completed';
import { buildAppointmentAssignedMessage } from './appointment-assigned';

type StaffTemplateFn = (apt: AppointmentWithDetails, locale: Locale) => Promise<RenderedMessage>;

export const TEMPLATE_MAP: Record<NotificationEventType, StaffTemplateFn> = {
  'appointment.created': buildAppointmentCreatedMessage,
  'appointment.confirmed': buildAppointmentConfirmedMessage,
  'appointment.cancelled': buildAppointmentCancelledMessage,
  'appointment.completed': buildAppointmentCompletedMessage,
  'appointment.professional_assigned': buildAppointmentAssignedMessage,
};
