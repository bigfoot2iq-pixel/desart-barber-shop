import type { PaymentMethod, HomeDetails } from "@/lib/types/database";

export type LocationOption = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  type: "salon" | "home";
};

export type BarberOption = {
  id: string;
  salonId: string | null;
  shortName: string;
  name: string;
  role: string;
  years: number;
  tags: string[];
  imageUrl: string | null;
  offersHomeVisit: boolean;
  services: ServiceOption[];
};

export type ServiceOption = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
};

// One guest's booking line inside a group. Solo bookings are a
// single-element array whose name is filled from the account holder.
export type GuestDraft = {
  name: string;
  serviceIds: string[];
};

export type BookingDraft = {
  locationType: "salon" | "home";
  salonId: string | null;
  homePin: { lat: number; lng: number } | null;
  homeLabel: string | null;
  homeDetails: HomeDetails | null;
  barberId: string;
  // Flat DISTINCT union of every guest's services (kept for the legacy
  // single-appointment write path and back-compat reads).
  serviceIds: string[];
  // Per-guest breakdown; guests[0] is the account holder. length === partySize.
  guests: GuestDraft[];
  partySize: number;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  phone: string;
  totalPrice: number;
  tipMad: number;
  durationMinutes: number;
  paymentMethod: PaymentMethod;
};