export type UserRole = 'admin' | 'professional' | 'customer';
export type LocationType = 'salon' | 'home';
export type PaymentMethod = 'cash' | 'bank_transfer';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

// Customer-supplied access detail for a home ("à domicile") visit, stored as
// JSONB in appointments.home_details. The GPS pin + reverse-geocoded label
// already resolve street/neighborhood; this captures the one thing they can't —
// which unit and how to be found (floor, apt/door no, door code, landmark) — as
// a single free-text note. `home_address` holds the composed human summary.
export interface HomeDetails {
  accessNotes: string;
}

export interface Profile {
  id: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  locale: 'fr' | 'en';
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Salon {
  id: string;
  name: string;
  name_fr?: string | null;
  address: string;
  address_fr?: string | null;
  latitude: number;
  longitude: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Professional {
  id: string;
  salon_id: string | null;
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
  name_fr?: string | null;
  description: string | null;
  description_fr?: string | null;
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
  home_details: HomeDetails | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  payment_method: PaymentMethod;
  status: AppointmentStatus;
  total_price_mad: number;
  tip_mad: number;
  // Number of people served in this one booking. 1 = solo (default);
  // >1 = a group served back-to-back by the single chosen barber.
  party_size: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentService {
  appointment_id: string;
  service_id: string;
}

// One person in a group booking. `name` is a first name so the barber
// knows who's who; the account holder (appointment.customer_id) is the
// single payer/contact and is guest sort_order = 0.
export interface AppointmentGuest {
  id: string;
  appointment_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export type AppointmentGuestWithServices = AppointmentGuest & { services: Service[] };

export type AppointmentWithDetails = Appointment & {
  professional: Professional | null;
  preferred_professional: Professional | null;
  customer: Profile;
  salon: Salon | null;
  services: Service[];
  // Per-guest breakdown, sorted by sort_order. Empty for solo bookings.
  guests: AppointmentGuestWithServices[];
};

export interface AppointmentReview {
  id: string;
  appointment_id: string;
  customer_id: string;
  professional_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface PaymentBankAccount {
  id: string;
  label: string | null;
  account_holder: string;
  bank_name: string;
  rib: string;
  iban: string | null;
  swift_bic: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentSettings {
  id: string;
  bank_transfer_enabled: boolean;
  payment_phone: string | null;
  instructions: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvitationToken {
  id: string;
  email: string;
  role: 'admin' | 'professional';
  token: string;
  invited_by: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}