export type UserRole = 'admin' | 'professional' | 'customer';
export type LocationType = 'salon' | 'home';
export type PaymentMethod = 'cash' | 'bank_transfer';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Profile {
  id: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Salon {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Professional {
  id: string;
  salon_id: string;
  display_name: string;
  profile_image_url: string | null;
  years_of_experience: number;
  phone: string;
  profession: string;
  offers_home_visit: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_mad: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalService {
  professional_id: string;
  service_id: string;
}

export interface ProfessionalAvailability {
  id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface AvailabilityOverride {
  id: string;
  professional_id: string;
  override_date: string;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export interface Appointment {
  id: string;
  professional_id: string | null;
  preferred_professional_id: string | null;
  customer_id: string;
  location_type: LocationType;
  salon_id: string | null;
  home_address: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  payment_method: PaymentMethod;
  status: AppointmentStatus;
  total_price_mad: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentService {
  appointment_id: string;
  service_id: string;
}

export type AppointmentWithDetails = Appointment & {
  professional: Professional | null;
  preferred_professional: Professional | null;
  customer: Profile;
  salon: Salon | null;
  services: Service[];
};