import type { NotificationEventType, RenderedMessage } from '../types';
import type { AppointmentWithDetails } from '@/lib/types/database';
import { buildAppointmentCreatedMessage } from './appointment-created';
import { buildAppointmentConfirmedMessage } from './appointment-confirmed';
import { buildAppointmentCancelledMessage } from './appointment-cancelled';
import { buildAppointmentCompletedMessage } from './appointment-completed';
import { buildAppointmentAssignedMessage } from './appointment-assigned';

export const TEMPLATE_MAP: Record<NotificationEventType, (apt: AppointmentWithDetails) => RenderedMessage> = {
  'appointment.created': buildAppointmentCreatedMessage,
  'appointment.confirmed': buildAppointmentConfirmedMessage,
  'appointment.cancelled': buildAppointmentCancelledMessage,
  'appointment.completed': buildAppointmentCompletedMessage,
  'appointment.professional_assigned': buildAppointmentAssignedMessage,
};
