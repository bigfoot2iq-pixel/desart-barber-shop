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

export type BookingDraft = {
  locationType: "salon" | "home";
  salonId: string | null;
  homePin: { lat: number; lng: number } | null;
  homeLabel: string | null;
  homeDetails: HomeDetails | null;
  barberId: string;
  serviceIds: string[];
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