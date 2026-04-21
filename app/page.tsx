"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReverseGeocode } from "@/hooks/use-reverse-geocode";
import { HERO_VIDEOS, DesktopVideoGrid, MobileVideoCarousel } from "@/app/components/video-grid";
import {
  getActiveProfessionalsWithServices,
  getActiveServices,
  getActiveSalons,
  getAllProfessionalsAvailability,
  getAllAvailabilityOverrides,
  getBookedSlots,
  getBookedSlotsInRange,
  createAppointment,
  updateProfile,
} from "@/lib/queries";
import type { ProfessionalWithServices } from "@/lib/queries/appointments";
import type { Salon, ProfessionalAvailability, AvailabilityOverride } from "@/lib/types/database";
import { useAuth } from "@/lib/auth-context";
import { MenuAvatarButton } from "@/components/user-panel/menu-avatar-button";
import { UserPanel } from "@/components/user-panel/user-panel";
import { buildTimeSlots, buildTimeSlotsWithStatus, getWorkingHoursForDate, toMinutes, toHHMM, toHHMMSS, SLOT_STEP_MINUTES, type WorkingHours } from "@/lib/booking/slots";
import { buildDateSlots, BOOKING_WINDOW_DAYS, type DateSlot } from "@/lib/booking/date-slots";

type LocationOption = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  type: "salon" | "home";
};

type BarberOption = {
  id: string;
  shortName: string;
  name: string;
  role: string;
  years: number;
  tags: string[];
  imageUrl: string | null;
  offersHomeVisit: boolean;
  services: ServiceOption[];
};

type ServiceOption = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
};

const REEL_DURATION_MS = 5000;
const STEP_LABELS = ["Choose a Location", "Choose a Berber", "Choose a Service", "Choose a Time", "Details"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type BookingDraft = {
  locationType: "salon" | "home";
  salonId: string | null;
  homePin: { lat: number; lng: number } | null;
  homeLabel: string | null;
  barberId: string;
  serviceIds: string[];
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  phone: string;
  totalPrice: number;
  durationMinutes: number;
};

const HOME_LOCATION: LocationOption = {
  id: "home",
  name: "Come To Me",
  description: "Home Visit (+30 MAD)",
  imageUrl: null,
  type: "home",
};

const HomePanelMapView = dynamic(
  () => import("@/components/map-view").then((mod) => ({ default: mod.MapView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl bg-[rgb(10_8_0/5%)] text-sm text-[rgb(10_8_0/35%)]" style={{ height: 230 }}>
        Loading map…
      </div>
    ),
  }
);


const MARQUEE_ITEMS = [
  "Precision Fades",
  "Classic Cuts",
  "Beard Sculpting",
  "Hot Towel Shaves",
  "Cash Only · No Fuss",
  "Same Day Booking",
  "Agadir Finest",
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Home() {
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [salons, setSalons] = useState<LocationOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<BarberOption | null>(null);
  const [selectedServices, setSelectedServices] = useState<ServiceOption[]>([]);
  const [selectedDate, setSelectedDate] = useState<DateSlot | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [expandedTeamMember, setExpandedTeamMember] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [showHomePanel, setShowHomePanel] = useState(false);
  const [homePin, setHomePin] = useState<{ lat: number; lng: number } | null>(null);
  const [homeLocating, setHomeLocating] = useState(false);
  const [nearbyActive, setNearbyActive] = useState(false);
  const [nearbyLocating, setNearbyLocating] = useState(false);
  const [rawSalons, setRawSalons] = useState<Salon[]>([]);
  const [salonDistances, setSalonDistances] = useState<Record<string, number>>({});
  const [barberWeekly, setBarberWeekly] = useState<ProfessionalAvailability[]>([]);
  const [barberOverrides, setBarberOverrides] = useState<AvailabilityOverride[]>([]);
  const [bookingsInRange, setBookingsInRange] = useState<{ professional_id: string | null; appointment_date: string; start_time: string; end_time: string }[]>([]);
  const [bookedSlots, setBookedSlots] = useState<{ key: string; slots: { start_time: string; end_time: string }[] } | null>(null);

  const [showUserPanel, setShowUserPanel] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    text: string;
    testid?: string;
  } | null>(null);

  const [isLoadingBarbers, setIsLoadingBarbers] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingSalons, setIsLoadingSalons] = useState(true);

  const prefersReducedMotion = useReducedMotion();

  const { user, signInWithGoogleModal, verifyUser } = useAuth();

  const submitTimerRef = useRef<number | null>(null);
  const dateSlots = useMemo(() => buildDateSlots(), []);
  const effectiveSelectedServices = useMemo(() => {
    if (!selectedBarber) return selectedServices;
    const ids = new Set(selectedBarber.services.map((s) => s.id));
    return selectedServices.filter((s) => ids.has(s.id));
  }, [selectedServices, selectedBarber]);
  const totalDurationMinutes = useMemo(
    () => effectiveSelectedServices.reduce((sum, s) => sum + s.duration, 0),
    [effectiveSelectedServices]
  );
  const weeklyForBarber = useMemo(
    () => (selectedBarber ? barberWeekly.filter((w) => w.professional_id === selectedBarber.id) : []),
    [barberWeekly, selectedBarber]
  );
  const overridesForBarber = useMemo(
    () => (selectedBarber ? barberOverrides.filter((o) => o.professional_id === selectedBarber.id) : []),
    [barberOverrides, selectedBarber]
  );
  const bookingsByBarberDate = useMemo(() => {
    const map = new Map<string, { start_time: string; end_time: string }[]>();
    for (const b of bookingsInRange) {
      if (!b.professional_id) continue;
      const key = `${b.professional_id}:${b.appointment_date}`;
      const list = map.get(key) ?? [];
      list.push({ start_time: b.start_time, end_time: b.end_time });
      map.set(key, list);
    }
    return map;
  }, [bookingsInRange]);
  const availableDateIds = useMemo(() => {
    if (!selectedBarber || weeklyForBarber.length === 0) return new Set<string>();
    const set = new Set<string>();
    const durationToCheck = totalDurationMinutes > 0 ? totalDurationMinutes : SLOT_STEP_MINUTES;
    for (const slot of dateSlots) {
      const hours = getWorkingHoursForDate(slot.id, weeklyForBarber, overridesForBarber);
      if (!hours) continue;
      const booked = bookingsByBarberDate.get(`${selectedBarber.id}:${slot.id}`) ?? [];
      if (buildTimeSlots(hours, durationToCheck, booked).length > 0) set.add(slot.id);
    }
    return set;
  }, [dateSlots, selectedBarber, weeklyForBarber, overridesForBarber, totalDurationMinutes, bookingsByBarberDate]);
  const timeSlotStatuses = useMemo(() => {
    if (!selectedBarber || !selectedDate || weeklyForBarber.length === 0) return [];
    const expectedKey = `${selectedBarber.id}:${selectedDate.id}`;
    const slots = bookedSlots?.key === expectedKey ? bookedSlots.slots : [];
    const hours = getWorkingHoursForDate(selectedDate.id, weeklyForBarber, overridesForBarber);
    return buildTimeSlotsWithStatus(hours, totalDurationMinutes, slots);
  }, [selectedBarber, selectedDate, weeklyForBarber, overridesForBarber, bookedSlots, totalDurationMinutes]);
  const availableTimeSlots = useMemo(
    () => timeSlotStatuses.filter((s) => s.available).map((s) => s.time),
    [timeSlotStatuses]
  );
  const effectiveSelectedTime = useMemo(
    () => (selectedTime && availableTimeSlots.includes(selectedTime) ? selectedTime : null),
    [selectedTime, availableTimeSlots]
  );
  const nextAvailableByBarber = useMemo(() => {
    const map = new Map<string, DateSlot | null>();
    for (const barber of barbers) {
      const weekly = barberWeekly.filter((w) => w.professional_id === barber.id);
      const overrides = barberOverrides.filter((o) => o.professional_id === barber.id);
      if (weekly.length === 0) {
        map.set(barber.id, null);
        continue;
      }
      const found = dateSlots.find((slot) => {
        const hours = getWorkingHoursForDate(slot.id, weekly, overrides);
        if (!hours) return false;
        const booked = bookingsByBarberDate.get(`${barber.id}:${slot.id}`) ?? [];
        return buildTimeSlots(hours, SLOT_STEP_MINUTES, booked).length > 0;
      }) ?? null;
      map.set(barber.id, found);
    }
    return map;
  }, [barbers, barberWeekly, barberOverrides, dateSlots, bookingsByBarberDate]);

  const { label: homePinLabel, loading: homePinGeoLoading } = useReverseGeocode(
    homePin?.lat ?? null,
    homePin?.lng ?? null
  );

  useEffect(() => {
    setIsLoadingBarbers(true);
    getActiveProfessionalsWithServices()
      .then((data: ProfessionalWithServices[]) => {
        const mapped: BarberOption[] = data.map((p) => ({
          id: p.id,
          shortName: p.display_name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2),
          name: p.display_name,
          role: p.profession,
          years: p.years_of_experience,
          tags: p.services.map((s) => s.name),
          imageUrl: p.profile_image_url,
          offersHomeVisit: p.offers_home_visit,
          services: p.services.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description ?? "",
            price: s.price_mad,
            duration: s.duration_minutes,
          })),
        }));
        setBarbers(mapped);
        setIsLoadingBarbers(false);
      })
      .catch((err) => {
        console.error("Failed to load professionals:", err);
        setIsLoadingBarbers(false);
      });

    setIsLoadingServices(true);
    getActiveServices()
      .then((data) => {
        setServices(
          data.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description ?? "",
            price: s.price_mad,
            duration: s.duration_minutes,
          }))
        );
        setIsLoadingServices(false);
      })
      .catch((err) => {
        console.error("Failed to load services:", err);
        setIsLoadingServices(false);
      });

    setIsLoadingSalons(true);
    getActiveSalons()
      .then((data: Salon[]) => {
        setRawSalons(data);
        const mapped: LocationOption[] = data.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.address,
          imageUrl: s.image_url,
          type: "salon" as const,
        }));
        setSalons(mapped);
        setIsLoadingSalons(false);
      })
      .catch((err) => {
        console.error("Failed to load salons:", err);
        setIsLoadingSalons(false);
      });
  }, []);

  useEffect(() => {
    if (barbers.length === 0) return;
    const ids = barbers.map((b) => b.id);
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + BOOKING_WINDOW_DAYS);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    let cancelled = false;
    Promise.all([
      getAllProfessionalsAvailability(ids),
      getAllAvailabilityOverrides(ids, fmt(today), fmt(end)),
      getBookedSlotsInRange(ids, fmt(today), fmt(end)),
    ])
      .then(([weekly, overrides, bookings]) => {
        if (cancelled) return;
        setBarberWeekly(weekly);
        setBarberOverrides(overrides);
        setBookingsInRange(bookings);
      })
      .catch((err) => {
        console.error("Failed to load barber availability:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [barbers]);

  useEffect(() => {
    if (!selectedBarber || !selectedDate) return;
    const key = `${selectedBarber.id}:${selectedDate.id}`;
    let cancelled = false;
    getBookedSlots(selectedBarber.id, selectedDate.id)
      .then((data) => {
        if (!cancelled) setBookedSlots({ key, slots: data });
      })
      .catch((err) => {
        console.error("Failed to load booked slots:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBarber, selectedDate]);

  const currentWeekDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const mondayOffset = dow === 0 ? 1 : dow === 1 ? 0 : -(dow - 1);
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const days: { date: number; dateStr: string; shortDay: string; monthStr: string; isPast: boolean; isAvailable: boolean; isFriday: boolean; isSelected: boolean }[] = [];

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const isPast = d < today;
      const isAvailable = !isPast && availableDateIds.has(dateStr);
      days.push({
        date: d.getDate(),
        dateStr,
        shortDay: dayNames[i],
        monthStr: MONTHS[d.getMonth()],
        isPast,
        isAvailable,
        isFriday: !isPast && !isAvailable,
        isSelected: false,
      });
    }
    return days;
  }, [availableDateIds]);

  const monthYearLabel = `${MONTHS[calendarMonth.month]} ${calendarMonth.year}`;

  const canGoPrevMonth = (() => {
    const now = new Date();
    return calendarMonth.year > now.getFullYear() || (calendarMonth.year === now.getFullYear() && calendarMonth.month > now.getMonth());
  })();

  const canGoNextMonth = dateSlots.some((slot) => {
    const d = new Date(slot.id + "T12:00:00");
    const nextMonth = calendarMonth.month === 11 ? 0 : calendarMonth.month + 1;
    const nextYear = calendarMonth.month === 11 ? calendarMonth.year + 1 : calendarMonth.year;
    return d.getFullYear() === nextYear && d.getMonth() === nextMonth;
  });

  const goPrevMonth = () => {
    if (!canGoPrevMonth) return;
    setCalendarMonth((prev) => ({
      year: prev.month === 0 ? prev.year - 1 : prev.year,
      month: prev.month === 0 ? 11 : prev.month - 1,
    }));
  };

  const goNextMonth = () => {
    if (!canGoNextMonth) return;
    setCalendarMonth((prev) => ({
      year: prev.month === 11 ? prev.year + 1 : prev.year,
      month: prev.month === 11 ? 0 : prev.month + 1,
    }));
  };

  const handleNearby = useCallback(() => {
    if (nearbyActive) {
      setNearbyActive(false);
      setSalonDistances({});
      setSalons(
        rawSalons.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.address,
          imageUrl: s.image_url,
          type: "salon" as const,
        }))
      );
      return;
    }
    if (!navigator.geolocation) {
      console.error("Geolocation not supported");
      return;
    }
    setNearbyLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log("Got position:", latitude, longitude);
        const distances: Record<string, number> = {};
        rawSalons.forEach((s) => {
          distances[s.id] = haversineKm(latitude, longitude, s.latitude, s.longitude);
          console.log("Distance to", s.name, ":", distances[s.id]);
        });
        setSalonDistances(distances);
        const sorted = [...rawSalons].sort((a, b) => distances[a.id] - distances[b.id]);
        console.log("Sorted salons:", sorted.map(s => s.name));
        setSalons(
          sorted.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.address,
            imageUrl: s.image_url,
            type: "salon" as const,
          }))
        );
        setNearbyActive(true);
        setNearbyLocating(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setToast({ kind: "error", text: "Location access denied. Please enable location in your browser settings." });
        setNearbyLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [nearbyActive, rawSalons, setToast]);

  const openHomePanel = useCallback(() => {
    setHomePin((prev) => prev ?? { lat: 30.4202, lng: -9.5982 });
    setShowHomePanel(true);
  }, []);

  const handleHomeMapClick = useCallback((lat: number, lng: number) => {
    setHomePin({ lat, lng });
  }, []);

  const handleHomeMarkerDrag = useCallback((lat: number, lng: number) => {
    setHomePin({ lat, lng });
  }, []);

  const handleHomeMyLocation = useCallback(() => {
    setHomeLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHomePin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setHomeLocating(false);
      },
      (err) => {
        setToast({ kind: "error", text: err.message });
        setHomeLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [setToast]);

  const handleConfirmHomeLocation = useCallback(() => {
    setSelectedLocation(HOME_LOCATION);
    setShowHomePanel(false);
  }, []);

  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDayRaw = new Date(year, month, 1).getDay();
    const firstDayMon = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: { date: number; isCurrentMonth: boolean; isAvailable: boolean; dateStr: string; isFriday: boolean }[] = [];

    for (let i = firstDayMon - 1; i >= 0; i--) {
      days.push({ date: prevMonthLastDay - i, isCurrentMonth: false, isAvailable: false, dateStr: "", isFriday: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isAvailable = availableDateIds.has(dateStr);
      days.push({
        date: d,
        isCurrentMonth: true,
        isAvailable,
        dateStr,
        isFriday: !isAvailable,
      });
    }

    const totalCells = days.length;
    const rows = Math.ceil(totalCells / 7);
    const targetCells = rows * 7;
    for (let i = 1; i <= targetCells - totalCells; i++) {
      days.push({ date: i, isCurrentMonth: false, isAvailable: false, dateStr: "", isFriday: false });
    }

    return days;
  }, [calendarMonth, availableDateIds]);

  const handleCalendarDateSelect = (dateStr: string) => {
    const slot = dateSlots.find((s) => s.id === dateStr);
    if (slot) setSelectedDate(slot);
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 60);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSlideIndex((previous) => (previous + 1) % HERO_VIDEOS.length);
    }, REEL_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [slideIndex]);

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showHomePanel) {
          setShowHomePanel(false);
          return;
        }
        if (showUserPanel) {
          setShowUserPanel(false);
          return;
        }
        setIsModalOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isModalOpen, showHomePanel, showUserPanel]);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current !== null) {
        window.clearTimeout(submitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const ms = toast.kind === "error" ? 5000 : 2800;
    const timer = window.setTimeout(() => setToast(null), ms);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const total = effectiveSelectedServices.reduce((sum, service) => sum + service.price, 0) + (selectedLocation?.type === "home" ? 30 : 0);
  const selectedServicesLabel = effectiveSelectedServices.map((service) => service.name).join(", ");

  const canContinue = (() => {
    if (step === 1) return Boolean(selectedLocation);
    if (step === 2) return Boolean(selectedBarber);
    if (step === 3) return effectiveSelectedServices.length > 0;
    if (step === 4) return Boolean(selectedDate && effectiveSelectedTime);
    if (step === 5) return Boolean(firstName.trim() && lastName.trim() && phone.trim());
    return true;
  })();

  const formComplete = Boolean(firstName.trim() && lastName.trim() && phone.trim());

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setShowHomePanel(false);
  };

  const resetBooking = () => {
    if (submitTimerRef.current !== null) {
      window.clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }
    setStep(1);
    setDirection("forward");
    setSelectedLocation(null);
    setSelectedBarber(null);
    setSelectedServices([]);
    setSelectedDate(null);
    setSelectedTime(null);
    setFirstName("");
    setLastName("");
    setPhone("");
    setIsSubmitting(false);
    setCalendarExpanded(false);
    setCalendarMonth(() => {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    });
    setShowHomePanel(false);
    setHomePin(null);
    setHomeLocating(false);
  };

  const finishBooking = () => {
    closeModal();
    resetBooking();
  };

  const goSlide = (index: number) => {
    setSlideIndex(index);
  };

  const toggleService = (service: ServiceOption) => {
    setSelectedServices((current) =>
      current.some((selected) => selected.id === service.id)
        ? current.filter((selected) => selected.id !== service.id)
        : [...current, service]
    );
  };

  const buildDraft = useCallback((): BookingDraft | null => {
    if (!selectedBarber || !selectedDate || !effectiveSelectedTime || !selectedLocation) return null;
    if (effectiveSelectedServices.length === 0) return null;
    return {
      locationType: selectedLocation.type,
      salonId: selectedLocation.type === "salon" ? selectedLocation.id : null,
      homePin: selectedLocation.type === "home" ? homePin : null,
      homeLabel: selectedLocation.type === "home" ? (homePinLabel ?? null) : null,
      barberId: selectedBarber.id,
      serviceIds: effectiveSelectedServices.map((s) => s.id),
      date: selectedDate.id,
      time: effectiveSelectedTime,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      totalPrice: total,
      durationMinutes: totalDurationMinutes,
    };
  }, [selectedBarber, selectedDate, effectiveSelectedTime, selectedLocation, effectiveSelectedServices, homePin, homePinLabel, firstName, lastName, phone, total, totalDurationMinutes]);

  const persistAppointment = useCallback(async (draft: BookingDraft, customerId: string) => {
    // Profile upsert must succeed — the appointment insert FKs to profiles.id,
    // so swallowing a failure here just trades a clear error for a confusing
    // 23503 later.
    await updateProfile({
      id: customerId,
      first_name: draft.firstName,
      last_name: draft.lastName,
      phone: draft.phone,
    });

    const startTime = toHHMMSS(draft.time);
    const endHHMM = toHHMM(toMinutes(draft.time) + draft.durationMinutes);
    const endTime = toHHMMSS(endHHMM);

    await createAppointment(
      {
        professional_id: null,
        preferred_professional_id: draft.barberId,
        customer_id: customerId,
        location_type: draft.locationType,
        salon_id: draft.locationType === "salon" ? draft.salonId : null,
        home_address: draft.homeLabel,
        home_latitude: draft.homePin?.lat ?? null,
        home_longitude: draft.homePin?.lng ?? null,
        appointment_date: draft.date,
        start_time: startTime,
        end_time: endTime,
        payment_method: "cash",
        status: "pending",
        total_price_mad: draft.totalPrice,
        notes: null,
      },
      draft.serviceIds
    );

    // Refresh booked slots so the UI is not stale if the user books again.
    setBookedSlots(null);
    const ids = barbers.map((b) => b.id);
    if (ids.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setDate(today.getDate() + BOOKING_WINDOW_DAYS);
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const refreshed = await getBookedSlotsInRange(ids, fmt(today), fmt(end));
      setBookingsInRange(refreshed);
    }
  }, [barbers]);

  const advanceStep = async () => {
    if (isSubmitting) return;

    if (step === 5) {
      if (!formComplete) return;
      const draft = buildDraft();
      if (!draft) return;

      const phoneRegex = /^(?:\+?212|0)\s?[5-7](?:[\s-]?\d){8}$/;
      if (!phoneRegex.test(phone.trim())) {
        setToast({ kind: "error", text: "Please enter a valid Moroccan phone number." });
        return;
      }

      setIsSubmitting(true);
      try {
        // Revalidate against the server — a cached `user` here may refer to
        // a JWT whose auth.users row has been deleted. Trusting it would hit
        // a 23503 FK error when we write the appointment.
        let customerId: string | null = null;
        if (user) {
          const verified = await verifyUser();
          if (verified) customerId = verified.id;
        }
        if (!customerId) {
          const signedInUser = await signInWithGoogleModal();
          customerId = signedInUser.id;
        }
        await persistAppointment(draft, customerId);
        setIsSubmitting(false);
        setDirection("forward");
        setStep(6);
      } catch (err) {
        console.error("Failed to save appointment:", err);
        if (err instanceof Error && err.message === 'SLOT_TAKEN') {
          setToast({ kind: "error", text: "That time was just booked. Please pick another slot.", testid: "text:booking-error" });
          setBookedSlots(null);
          if (selectedBarber && selectedDate) {
            const refreshed = await getBookedSlots(selectedBarber.id, selectedDate.id);
            const key = `${selectedBarber.id}:${selectedDate.id}`;
            setBookedSlots({ key, slots: refreshed });
          }
        } else {
          const message = err instanceof Error && err.message
            ? err.message
            : "Couldn't save your booking. Please try again.";
          setToast({ kind: "error", text: message, testid: "text:booking-error" });
        }
        setIsSubmitting(false);
      }
      return;
    }

    setDirection("forward");
    setStep((current) => Math.min(current + 1, 5));
  };

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && canContinue && step <= 5) {
        const target = event.target as HTMLElement;
        if (target.tagName === "TEXTAREA") return;
        if (step === 5 && target.tagName === "INPUT" && !formComplete) return;
        advanceStep();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, canContinue, step, formComplete, advanceStep]);

  const prevStep = () => {
    if (step <= 1 || isSubmitting) return;
    setDirection("back");
    const targetStep = step - 1;
    if (targetStep <= 1) setSelectedLocation(null);
    if (targetStep <= 2) setSelectedBarber(null);
    if (targetStep <= 3) setSelectedServices([]);
    if (targetStep <= 4) {
      setSelectedDate(null);
      setSelectedTime(null);
    }
    setStep(targetStep);
  };

  // Auto-advance on single-choice steps
  useEffect(() => {
    if (step === 1 && selectedLocation) {
      const t = window.setTimeout(() => {
        setDirection("forward");
        setStep((current) => Math.min(current + 1, 5));
      }, 500);
      return () => window.clearTimeout(t);
    }
  }, [selectedLocation, step]);

  useEffect(() => {
    if (step === 2 && selectedBarber) {
      const t = window.setTimeout(() => {
        setDirection("forward");
        setStep((current) => Math.min(current + 1, 5));
      }, 500);
      return () => window.clearTimeout(t);
    }
  }, [selectedBarber, step]);

  useEffect(() => {
    if (step === 4 && selectedDate && timeSlotStatuses.length === 0) {
      setCalendarExpanded(true);
    }
  }, [step, selectedDate, timeSlotStatuses]);

  useEffect(() => {
    if (step === 4 && selectedDate && effectiveSelectedTime) {
      const t = window.setTimeout(() => {
        setDirection("forward");
        setStep((current) => Math.min(current + 1, 5));
      }, 500);
      return () => window.clearTimeout(t);
    }
  }, [selectedDate, effectiveSelectedTime, step]);

  useEffect(() => {
    if (step !== 5) return;
    if (document.activeElement && (document.activeElement as HTMLElement).tagName === "INPUT") return;
    if (!firstName) {
      document.getElementById("f-first")?.focus();
    } else if (!lastName) {
      document.getElementById("f-last")?.focus();
    } else if (!phone) {
      document.getElementById("f-phone")?.focus();
    }
  }, [step, firstName, lastName, phone]);

  const stepVariants = {
    enter: (dir: "forward" | "back") => ({
      x: dir === "forward" ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: "forward" | "back") => ({
      x: dir === "forward" ? -60 : 60,
      opacity: 0,
    }),
  };

  const stepTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        type: "spring" as const,
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      };

  return (
    <>
      <nav id="main-nav" className={`fixed top-0 left-0 right-0 z-[300] flex items-center justify-between lg:px-[100px] px-[56px] py-5 transition-[background,padding] duration-300 ${isScrolled ? "bg-[rgb(10_8_0/90%)] [backdrop-filter:blur(18px)] py-[14px] border-b border-[rgb(254_251_243/10%)]" : ""}`}>
        <div className="flex items-center gap-2.5 font-playfair text-2xl font-bold tracking-[0.14em] text-gold3">
          <img src="/logo.jpg" alt="Desart" className="w-8 h-8 rounded-full object-cover shrink-0 md:w-9 md:h-9" />
          DESART
        </div>
        <button type="button" className="hidden flex-col gap-[5px] p-1" aria-label="Menu">
          <span className="block w-[22px] h-[1.5px] bg-brand-white" />
          <span className="block w-[22px] h-[1.5px] bg-brand-white" />
          <span className="block w-[22px] h-[1.5px] bg-brand-white" />
        </button>
      </nav>

      <section className="relative bg-brand-black text-brand-white min-h-svh overflow-hidden grid grid-cols-1 gap-8 max-sm:gap-4 items-center py-12 px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:pt-[110px] lg:pb-0 lg:pr-0">

        {/* Left column */}
        <div className="relative z-[3] pb-6 max-sm:pb-2 max-w-[560px] lg:pl-[100px] lg:pb-20">
          <span className="inline-flex items-center gap-2.5 text-gold3 mb-7 text-[11px] tracking-[.18em] uppercase font-medium before:content-[''] before:w-6 before:h-px before:bg-current">
            Agadir · Est. 2019
          </span>
          <h1 className="font-fraunces font-normal text-[clamp(48px,5.5vw,76px)] leading-[.92] tracking-[-0.035em]">
            Sharp cuts.<br />
            Sharper <em className="italic font-normal text-gold3">style.</em>
          </h1>
          <p className="mt-7 text-brand-white/60 text-base leading-[1.7] max-w-[440px] font-light">
            Premium grooming for those who know the difference. Walk in, sit down, walk out sharper — by appointment or by chance.
          </p>
          <div className="flex gap-3.5 items-center mt-10 flex-wrap max-sm:hidden">
            <button
              type="button"
              onClick={openModal}
              className="open-booking inline-flex items-center gap-2.5 px-[22px] py-[15px] bg-brand-white text-brand-black text-[11px] tracking-[.16em] uppercase font-semibold border border-transparent transition-[transform,background-color] duration-150 hover:-translate-y-px hover:bg-gold3"
              data-testid="btn:open-booking"
            >
              Reserve a chair
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="w-3.5 h-3.5"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </button>
            <a
              href="#services"
              className="inline-flex items-center gap-2.5 px-[22px] py-[15px] text-brand-white border border-brand-white/25 text-[11px] tracking-[.16em] uppercase font-semibold transition-[border-color] duration-150 hover:border-brand-white"
            >
              View menu
            </a>
          </div>
          <div className="flex gap-8 flex-wrap mt-16 pt-6 border-t border-brand-white/10 text-brand-white/50 max-sm:gap-5 max-sm:mt-10 max-sm:hidden">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] tracking-[.18em] uppercase font-medium">Hours</span>
              <span className="text-brand-white font-playfair text-[18px] tracking-[-0.01em]">9:00 — 17:00</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] tracking-[.18em] uppercase font-medium">Closed</span>
              <span className="text-brand-white font-playfair text-[18px] tracking-[-0.01em]">Friday</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] tracking-[.18em] uppercase font-medium">Payment</span>
              <span className="text-brand-white font-playfair text-[18px] tracking-[-0.01em]">Cash only</span>
            </div>
          </div>
        </div>

        {/* Right column — carousel on mobile, scrolling grid on desktop */}
        <div className="relative z-[2] overflow-hidden h-auto lg:h-svh lg:-mt-[120px]">
          {/* Mobile carousel */}
          <div className="lg:hidden">
            <MobileVideoCarousel />
          </div>
          {/* Desktop grid */}
          <div className="hidden lg:block h-full">
            <div className="absolute inset-x-0 top-0 h-[140px] z-[5] pointer-events-none bg-gradient-to-b from-brand-black to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[140px] z-[5] pointer-events-none bg-gradient-to-t from-brand-black to-transparent" />
            <DesktopVideoGrid />
          </div>
        </div>

      </section>

      <section id="services" className="bg-gold-bg text-brand-black py-12 px-4">
        <div className="max-w-[1160px] mx-auto">
          <div className="flex flex-col items-start gap-3 mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-5 sm:mb-14">
            <div>
              <div className="before:content-[''] before:w-[26px] before:h-px before:bg-current inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[0.22em] uppercase text-[rgb(10_8_0/55%)] mb-[14px]">What We Do</div>
              <h2 className="font-playfair text-[clamp(40px,5vw,66px)] font-normal leading-[1.05] tracking-[-0.01em] mb-[14px] [&_em]:italic">Services</h2>
            </div>
            <p className="text-[17px] font-light leading-[1.8] max-w-[480px] opacity-60">Cash only. Same-day booking available.</p>
          </div>

          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-[2px]">
            {services.map((service) => (
              <div className="group relative overflow-hidden bg-[rgb(10_8_0/7%)] p-8 lg:px-8 lg:pt-10 lg:pb-9 transition-[background] duration-250 hover:bg-[rgb(10_8_0/14%)]" key={service.id}>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-black scale-x-0 origin-left transition-transform duration-350 group-hover:scale-x-100" />
                <div className="font-playfair text-[22px] lg:text-[27px] font-normal mb-1.5">{service.name}</div>
                <div className="text-[13px] text-[rgb(10_8_0/50%)] leading-[1.7] mb-8">{service.description}</div>
                <div className="flex justify-between items-baseline mt-auto">
                  <span className="text-[20px] font-medium">{service.price} <span className="text-[13px] font-normal text-[rgb(10_8_0/50%)]">MAD</span></span>
                  <span className="text-[11px] tracking-[0.06em] text-[rgb(10_8_0/40%)]">{service.duration} min</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:hidden border-t border-[rgb(10_8_0/10%)]">
            {services.map((service) => {
              const isOpen = expandedService === service.id;
              return (
                <div key={service.id}>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between py-5 px-1 text-left bg-transparent border-0 cursor-pointer font-[inherit]"
                    onClick={() => setExpandedService(isOpen ? null : service.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="font-playfair text-[19px] font-normal">{service.name}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-[15px] font-medium">{service.price} MAD</span>
                      <span className={`w-4 h-4 flex items-center justify-center transition-transform duration-250 ${isOpen ? "rotate-45" : ""}`}>
                        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10" /></svg>
                      </span>
                    </span>
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-250 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <div className="pb-5 px-1 -mt-1">
                        <p className="text-[13px] text-[rgb(10_8_0/50%)] leading-[1.65] mb-2">{service.description}</p>
                        <span className="text-[11px] tracking-[0.06em] text-[rgb(10_8_0/40%)]">{service.duration} min</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-b border-[rgb(10_8_0/8%)]" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="bg-gold overflow-hidden py-[22px] border-y border-[rgb(10_8_0/10%)]">
        <div className="flex whitespace-nowrap animate-marquee hover:[animation-play-state:paused]">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, index) => (
            <div
              className="inline-flex items-center gap-[26px] px-[26px] font-playfair text-[19px] font-normal italic text-brand-black shrink-0"
              key={`${item}-${index}`}
            >
              {item} <span className="w-1 h-1 rounded-full bg-brand-black opacity-30 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <section id="team" className="bg-brand-black text-brand-white py-12 px-4">
        <div className="max-w-[1160px] mx-auto">
          <div className="flex flex-col items-start gap-3 mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-5 sm:mb-14">
            <div>
              <div className="before:content-[''] before:w-[26px] before:h-px before:bg-current inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[0.22em] uppercase text-[rgb(254_251_243/50%)] mb-[14px]">The Craftsmen</div>
              <h2 className="font-playfair text-[clamp(40px,5vw,66px)] font-normal leading-[1.05] tracking-[-0.01em] mb-[14px] [&_em]:italic text-brand-white">
                Meet Our <em className="text-gold3">Team</em>
              </h2>
              <p className="text-[17px] font-light leading-[1.8] max-w-[480px] opacity-60 text-[rgb(254_251_243/50%)]">Every one of our barbers brings a distinct edge. Pick your style, pick your pro.</p>
            </div>
          </div>

          {/* Mobile: Accordion */}
          <div className="flex flex-col sm:hidden border-t border-[rgb(254_251_243/10%)]">
            {barbers.length === 0 && (
              <p className="text-center text-[rgb(254_251_243/40%)] py-10 text-[13px]">Loading team...</p>
            )}
            {barbers.map((barber) => {
              const isOpen = expandedTeamMember === barber.id;
              return (
                <div key={barber.id}>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between py-5 px-1 text-left bg-transparent border-0 cursor-pointer font-[inherit]"
                    onClick={() => setExpandedTeamMember(isOpen ? null : barber.id)}
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full border-[1.5px] border-[rgb(192_154_90/35%)] bg-[rgb(192_154_90/10%)] flex items-center justify-center font-playfair text-[15px] text-gold3 shrink-0">
                        {barber.shortName}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-playfair text-[19px] font-normal text-brand-white">{barber.name}</span>
                        <span className="text-[11px] tracking-[0.08em] uppercase text-gold3 mt-0.5">{barber.role} · {barber.years} Yrs</span>
                      </div>
                    </div>
                    <span className={`w-4 h-4 flex items-center justify-center transition-transform duration-250 text-brand-white ${isOpen ? "rotate-45" : ""}`}>
                      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10" /></svg>
                    </span>
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-250 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <div className="pb-5 px-1 -mt-1">
                        <div className="flex flex-wrap gap-1.5">
                          {barber.tags.map((tag) => (
                            <span key={tag} className="text-[11px] text-[rgb(254_251_243/50%)] border border-[rgb(254_251_243/10%)] rounded-[3px] px-2.5 py-1 tracking-[0.04em]">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-b border-[rgb(254_251_243/8%)]" />
                </div>
              );
            })}
          </div>

          {/* Desktop: Cards */}
          <div className="hidden sm:grid sm:grid-cols-3 sm:gap-5">
            {barbers.map((barber) => {
              return (
                <div key={barber.id} className="group bg-ink border border-[rgb(254_251_243/10%)] rounded-[18px] overflow-hidden transition-[border-color,transform] duration-300 hover:border-[rgb(192_154_90/40%)] hover:-translate-y-1.5">
                  <div className="relative h-[300px] bg-[#161208] flex items-center justify-center overflow-hidden">
                    {barber.imageUrl ? (
                      <>
                        <img src={barber.imageUrl} alt={barber.name} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(22_18_8)_0%,rgb(22_18_8/60%)_40%,transparent_70%)]" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,rgb(192_154_90/7%),transparent_70%)]" />
                    )}

                  </div>
                  <div className="p-7">
                    <div className="font-playfair text-[26px] font-normal text-brand-white mb-0.5">{barber.name}</div>
                    <div className="text-xs text-gold3 tracking-[0.08em] uppercase mb-4">{barber.role} · {barber.years} Yrs</div>
                    <div className="flex flex-wrap gap-[7px]">
                      {barber.tags.map((tag) => (
                        <span key={tag} className="text-[11px] text-[rgb(254_251_243/50%)] border border-[rgb(254_251_243/10%)] rounded-[3px] px-2.5 py-1 tracking-[0.04em]">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="relative overflow-hidden bg-black2 border-t-2 border-gold/30 py-16 px-6 text-center md:py-24 md:px-14 lg:py-28">
        <div className="pointer-events-none absolute -top-[200px] left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(192,154,90,0.07)_0%,transparent_65%)]" />
        <div className="relative z-10 mx-auto max-w-[820px]">
          
          <p className="mb-7 font-playfair text-[clamp(1.875rem,4.5vw,3.25rem)] font-normal italic leading-snug text-brand-white">
            Your chair is waiting. Your best look is one appointment <em className="not-italic text-gold3">away.</em>
          </p>
          <cite className="text-xs font-normal uppercase tracking-[0.18em] text-brand-white/30 not-italic">Desart — Agadir, Since 2019</cite>
        </div>
      </div>

      <section id="locations" className="bg-gold-bg text-brand-black py-12 px-4">
        <div className="max-w-[1160px] mx-auto">
          <div className="flex items-end justify-between gap-5 flex-wrap mb-[50px]">
            <div>
              <div className="before:content-[''] before:w-[26px] before:h-px before:bg-current inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[0.22em] uppercase text-[rgb(10_8_0/55%)] mb-[14px]">Find Us</div>
              <h2 className="font-playfair text-[clamp(40px,5vw,66px)] font-normal leading-[1.05] tracking-[-0.01em] mb-[14px] [&_em]:italic">
                Our <em>Locations</em>
              </h2>
            </div>
            <p className="text-[17px] font-light leading-[1.8] max-w-[480px] opacity-60">Visit us at the salon or let us come to you — your call.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-[rgb(10_8_0/7%)] rounded-[18px] p-6 sm:p-11">
              <h3 className="font-playfair text-[30px] font-normal mb-[7px]">Desart Salon</h3>
              <span className="text-[11px] tracking-[0.12em] uppercase text-[rgb(10_8_0/55%)] mb-7 block">Flagship Location</span>
              <div className="flex items-start gap-3.5 mb-[18px]">
                <svg className="w-[18px] h-[18px] shrink-0 mt-px opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <p className="text-sm leading-[1.7] opacity-70">
                  14 Rue Mohammed V, Medína
                  <br />
                  Agadir 40000, Morocco
                </p>
              </div>
              <div className="flex items-start gap-3.5 mb-[18px]">
                <svg className="w-[18px] h-[18px] shrink-0 mt-px opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
                <p className="text-sm leading-[1.7] opacity-70">+212 600 000 000</p>
              </div>
              <div className="flex flex-col gap-0 mt-[18px]">
                <div className="flex justify-between text-[13px] py-2.5 border-b border-[rgb(10_8_0/10%)]">
                  <span className="opacity-50">Saturday – Thursday</span>
                  <span className="font-medium">9:00 – 17:00</span>
                </div>
                <div className="flex justify-between text-[13px] py-2.5 border-b border-[rgb(10_8_0/10%)]">
                  <span className="opacity-50">Friday</span>
                  <span className="font-medium">Closed</span>
                </div>
              </div>
              <button type="button" className="mt-8 bg-brand-black text-white text-[11px] font-medium tracking-[0.1em] uppercase py-[13px] px-7 rounded-[3px] inline-block cursor-pointer transition-all duration-200 hover:bg-ink hover:-translate-y-px open-booking" onClick={openModal}>
                Book This Location →
              </button>
            </div>

            <div className="bg-[rgb(10_8_0/7%)] rounded-[18px] p-6 sm:p-11">
              <h3 className="font-playfair text-[30px] font-normal mb-[7px]">Home Visit</h3>
              <span className="text-[11px] tracking-[0.12em] uppercase text-[rgb(10_8_0/55%)] mb-7 block">+30 MAD Travel Fee</span>
              <div className="flex items-start gap-3.5 mb-[18px]">
                <svg className="w-[18px] h-[18px] shrink-0 mt-px opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <p className="text-sm leading-[1.7] opacity-70">We travel anywhere within Agadir city limits. Just provide your address at booking.</p>
              </div>
              <div className="flex items-start gap-3.5 mb-[18px]">
                <svg className="w-[18px] h-[18px] shrink-0 mt-px opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p className="text-sm leading-[1.7] opacity-70">Sat–Thu · 9:00 – 17:00. Same barbers, same quality, at your door.</p>
              </div>
              <div className="flex items-start gap-3.5 mb-[18px]">
                <svg className="w-[18px] h-[18px] shrink-0 mt-px opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <p className="text-sm leading-[1.7] opacity-70">Cash payment on the day. No card required at booking.</p>
              </div>
              <button type="button" className="mt-8 bg-brand-black text-white text-[11px] font-medium tracking-[0.1em] uppercase py-[13px] px-7 rounded-[3px] inline-block cursor-pointer transition-all duration-200 hover:bg-ink hover:-translate-y-px open-booking" onClick={openModal}>
                Book Home Visit →
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-brand-black text-white pt-12 sm:pt-20 pb-10 px-4 sm:px-14 border-t border-[rgb(254_251_243/10%)]">
        <div className="max-w-[1160px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-[1.8fr_1fr_1fr] gap-10 sm:gap-16 mb-16">
            <div>
              <span className="font-playfair text-[28px] font-bold tracking-[0.14em] text-gold3 block mb-4">DESART</span>
              <p className="text-sm text-[rgb(254_251_243/40%)] leading-[1.85] max-w-[270px]">
                Premium barbershop experience in the heart of Agadir. Walk-ins welcome, appointments preferred. Cash
                only — always.
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-medium tracking-[0.2em] uppercase text-gold3 mb-[22px]">Navigate</h4>
              <ul className="list-none flex flex-col gap-3">
                <li>
                  <a href="#services" className="text-sm text-[rgb(254_251_243/40%)] transition-colors duration-200 hover:text-white">Services</a>
                </li>
                <li>
                  <a href="#team" className="text-sm text-[rgb(254_251_243/40%)] transition-colors duration-200 hover:text-white">Our Team</a>
                </li>
                <li>
                  <a href="#locations" className="text-sm text-[rgb(254_251_243/40%)] transition-colors duration-200 hover:text-white">Locations</a>
                </li>
                <li>
                  <button type="button" className="text-sm text-[rgb(254_251_243/40%)] p-0 transition-colors duration-200 hover:text-white open-booking" onClick={openModal}>
                    Book Now
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-medium tracking-[0.2em] uppercase text-gold3 mb-[22px]">Contact</h4>
              <ul className="list-none flex flex-col gap-3">
                <li className="text-sm text-[rgb(254_251_243/40%)]">14 Rue Mohammed V, Agadir</li>
                <li>
                  <a href="tel:+212600000000" className="text-sm text-[rgb(254_251_243/40%)] transition-colors duration-200 hover:text-white">+212 600 000 000</a>
                </li>
                <li className="text-sm text-[rgb(254_251_243/40%)]">Sat–Thu: 9:00 – 17:00</li>
                <li className="text-sm text-[rgb(254_251_243/40%)]">Friday: Closed</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[rgb(254_251_243/10%)] pt-7 flex justify-between items-center flex-wrap gap-3">
            <p className="text-[13px] text-[rgb(254_251_243/28%)]">© 2026 Desart. Cash only · Agadir, Morocco</p>
            <div className="flex gap-3.5">
              <a className="w-[34px] h-[34px] rounded-full border border-[rgb(254_251_243/10%)] flex items-center justify-center text-[rgb(254_251_243/35%)] transition-all duration-200 hover:border-gold hover:text-gold" href="#" aria-label="Instagram">
                <svg className="w-[15px] h-[15px] fill-none stroke-current stroke-[1.5]" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {!isModalOpen && (
          <motion.button
            type="button"
            className="fixed bottom-8 right-8 z-[400] bg-white text-black text-xs font-bold tracking-[0.1em] uppercase py-[15px] px-[26px] rounded-full flex items-center justify-end gap-2.5 shadow-[0_2px_8px_rgb(0_0_0/15%)] hover:shadow-[0_4px_12px_rgb(0_0_0/25%)] open-booking"
            onClick={openModal}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            Book Now
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 z-[500] flex items-end justify-end p-5 pointer-events-none bg-[rgb(10_8_0/35%)] [backdrop-filter:blur(4px)] max-sm:p-0 max-sm:bg-[#fafaf8] max-sm:[backdrop-filter:none] max-sm:items-stretch max-sm:justify-stretch"
              onClick={(event) => {
              if (event.target === event.currentTarget) {
                if (step >= 5) return;
                closeModal();
              }
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="relative w-[375px] h-[727px] bg-[#fafaf8] rounded-l-[20px] flex flex-col overflow-hidden shadow-[-12px_0_60px_rgb(0_0_0/12%),-4px_0_20px_rgb(0_0_0/6%)] pointer-events-auto font-dm-sans max-sm:w-full max-sm:h-full max-sm:rounded-none max-sm:shadow-none [&_*]:font-[inherit] [&_.font-playfair]:font-playfair"
              role="dialog"
              aria-modal="true"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 200 }}
            >
              <AnimatePresence>
                {toast && (
                  <motion.div
                    className="absolute top-3 left-3 right-3 z-[30]"
                    initial={{ y: -40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -40, opacity: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", damping: 28, stiffness: 250 }}
                  >
                    <div
                      data-testid={toast.testid}
                      role={toast.kind === "error" ? "alert" : "status"}
                      aria-live={toast.kind === "error" ? "assertive" : "polite"}
                      className={`rounded-xl px-4 py-3 text-sm font-medium shadow-[0_4px_16px_rgb(0_0_0/12%)] ${
                        toast.kind === "success"
                          ? "bg-[#c09a5a] text-white"
                          : "bg-red-600 text-white"
                      }`}
                    >
                      {toast.text}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative flex items-center gap-1.5 px-5 pt-[18px] pb-4 bg-white border-b border-[rgb(10_8_0/11%)] shrink-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[rgb(10_8_0/4%)] after:to-transparent">
                <AnimatePresence>
                  {step > 1 && step < 6 && (
                    <motion.button
                      key="back-arrow"
                      type="button"
                      initial={false}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } }}
                      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                      className="w-8 h-8 flex items-center justify-center bg-none border-none cursor-pointer text-brand-black rounded-lg transition-[background,color] duration-200 shrink-0 p-0 hover:bg-[rgb(10_8_0/6%)] active:bg-[rgb(10_8_0/10%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                      onClick={prevStep}
                      aria-label="Go back"
                    >
                      <svg viewBox="0 0 9 16" width="9" height="16">
                        <path d="M8 1L1 8l7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.button>
                  )}
                </AnimatePresence>
                <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={step}
                      className="text-[15px] font-bold text-brand-black m-0 text-left tracking-[-0.01em]"
                      id="panel-title"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {step === 1 && "Choose a Location"}
                      {step === 2 && "Choose a Berber"}
                      {step === 3 && "Choose a Service"}
                      {step === 4 && "Choose a Time"}
                      {step === 5 && "Your Details"}
                      {step === 6 && "Booking Confirmed"}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <MenuAvatarButton onClick={() => setShowUserPanel(true)} />
                <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center bg-none border border-[rgb(10_8_0/20%)] cursor-pointer text-brand-black transition-[background,border-color] duration-200 shrink-0 p-0 hover:bg-[rgb(10_8_0/5%)] hover:border-[rgb(10_8_0/30%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2" onClick={() => {
                  if (step === 5 && (firstName.trim() || lastName.trim() || phone.trim())) {
                    if (!window.confirm("Discard your booking details?")) return;
                  }
                  closeModal();
                }} aria-label="Close">
                  <svg viewBox="0 0 10 10" width="10" height="10">
                    <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-hidden relative bg-[#fafaf8]">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={stepTransition}
                    className="absolute inset-0 overflow-y-auto p-5 [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[rgb(10_8_0/15%)] [&::-webkit-scrollbar-thumb]:rounded-sm"
                  >
                    {step === 1 && (
                      <>
                        <div className="flex mb-4">
                          <button type="button" onClick={handleNearby} disabled={nearbyLocating} className={`flex items-center justify-center h-8 px-3 mr-3 rounded-full border uppercase text-[11px] font-semibold tracking-[0.05em] transition-all duration-200 ${nearbyActive ? "border-gold bg-gold text-white" : nearbyLocating ? "border-[rgb(10_8_0/22%)] bg-white text-black cursor-wait" : "border-[rgb(10_8_0/22%)] bg-white text-black hover:border-[rgb(10_8_0/30%)] hover:bg-[rgb(10_8_0/3%)]"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}>
                            {nearbyLocating ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="mr-1.5 animate-spin opacity-60" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                              </svg>
                            ) : (
                              <svg width="10" height="12" viewBox="0 0 10 12" fill="none" className={`mr-1.5 ${nearbyActive ? "opacity-80" : "opacity-60"}`} stroke="currentColor" strokeWidth="1.5">
                                <path d="M5 0C2.79 0 1 1.79 1 4c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z"/>
                                <circle cx="5" cy="4" r="1.5"/>
                              </svg>
                            )}
                            Nearby
                          </button>
                          <button type="button" className={`flex items-center justify-center h-8 px-3 mr-3 rounded-full border uppercase text-[11px] font-semibold tracking-[0.05em] transition-all duration-200 ${showHomePanel ? "border-gold bg-gold text-white" : "border-[rgb(10_8_0/22%)] bg-white text-black hover:border-[rgb(10_8_0/30%)] hover:bg-[rgb(10_8_0/3%)]"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`} onClick={openHomePanel}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 opacity-60">
                              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                              <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                            Come to me
                          </button>
                        </div>
                        {isLoadingSalons && salons.length === 0 && (
                          <div className="grid grid-cols-1 gap-2.5 mb-4">
                            {[1,2,3].map((i) => (
                              <div key={i} className="flex items-start gap-3.5 rounded-2xl px-[18px] py-3.5 border-[1.5px] border-[rgb(10_8_0/8%)] bg-[rgb(10_8_0/3%)] animate-pulse">
                                <div className="shrink-0 w-[107px] h-[107px] rounded-[10px] bg-[rgb(10_8_0/8%)]" />
                                <div className="flex-1 flex flex-col gap-2 mt-2">
                                  <div className="h-4 bg-[rgb(10_8_0/8%)] rounded w-3/4" />
                                  <div className="h-3 bg-[rgb(10_8_0/6%)] rounded w-1/2" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className={`grid grid-cols-1 gap-2.5 transition-opacity ${nearbyLocating ? "animate-pulse pointer-events-none" : ""}`}>
                          {salons.map((location) => {
                            const isLocationSelected = selectedLocation?.id === location.id;
                            return (
                              <button
                                key={location.id}
                                type="button"
                                data-testid={`btn:location-${location.id}`}
                                className={`flex items-start gap-3.5 rounded-2xl px-[18px] py-3.5 text-left transition-all duration-200 relative ${isLocationSelected ? "border-[1.5px] border-gold bg-gold" : "border-[1.5px] border-[rgb(10_8_0/14%)] bg-white shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/24%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                onClick={() => setSelectedLocation(location)}
                              >
                                {location.imageUrl ? (
                                  <img src={location.imageUrl} alt={location.name} className={`shrink-0 w-[107px] h-[107px] rounded-[10px] object-cover transition-[border-color] duration-200 ${isLocationSelected ? "border-2 border-[rgb(255_255_255/30%)]" : "border-2 border-[rgb(192_154_90/20%)]"}`} />
                                ) : (
                                  <div className={`relative flex items-center justify-center shrink-0 w-[107px] h-[107px] rounded-[10px] ${isLocationSelected ? "bg-[rgb(255_255_255/25%)]" : "bg-[rgb(10_8_0/4%)]"}`}>
                                    <svg className={`w-12 h-12 transition-[opacity,color] duration-200 ${isLocationSelected ? "opacity-100 text-white" : "opacity-70 text-brand-black"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M5 2.5l2-1.5h10l2 1.5" />
                                      <rect x="2" y="2.5" width="20" height="2.5" />
                                      <rect x="1" y="5" width="22" height="3" />
                                      <text x="12" y="7.2" textAnchor="middle" fontSize="4" fontWeight="bold" fill="currentColor" stroke="none">SALON</text>
                                      <circle cx="14.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
                                      <line x1="1.5" y1="6" x2="3" y2="6" />
                                      <line x1="1.5" y1="7" x2="3" y2="7" />
                                      <line x1="21" y1="6" x2="22.5" y2="6" />
                                      <line x1="21" y1="7" x2="22.5" y2="7" />
                                      <rect x="2" y="8" width="20" height="13.5" rx="1" />
                                      <rect x="5" y="10" width="5" height="11.5" rx="0.5" />
                                      <circle cx="7.5" cy="16" r="0.4" fill="currentColor" stroke="none" />
                                      <rect x="13" y="10" width="7" height="11.5" rx="0.5" />
                                      <line x1="13" y1="15.5" x2="20" y2="15.5" />
                                      <path d="M2 21.5h20" />
                                    </svg>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className={`text-[17px] font-semibold leading-snug tracking-[-0.408px] mb-0.5 truncate ${isLocationSelected ? "text-white" : "text-brand-black"}`}>{location.name}</div>
                                  <div className={`text-[13px] leading-[18px] tracking-[-0.078px] font-normal line-clamp-2 ${isLocationSelected ? "text-[rgb(255_255_255/70%)]" : "text-[rgb(10_8_0/55%)]"}`}>{location.description}</div>
                                  {nearbyActive && salonDistances[location.id] != null && (
                                    <div className="mt-2">
                                      <div className="w-[30px] border-t border-[rgb(199_199_204)] mb-1" />
                                       <p data-testid="text:distance" className={`text-[15px] leading-[18px] tracking-[-0.24px] ${isLocationSelected ? "text-[rgb(255_255_255/80%)]" : "text-[rgb(10_8_0/55%)]"}`}>
                                         {salonDistances[location.id] < 1
                                           ? `${(salonDistances[location.id] * 1000).toFixed(0)} m`
                                           : `${salonDistances[location.id].toFixed(2)} Km`
                                         }
                                       </p>
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {step === 2 && (
                      <>
                        
                        <div className="flex flex-col gap-2">
                          {isLoadingBarbers && barbers.length === 0 && (
                            <div className="flex flex-col gap-2">
                              {[1,2,3].map((i) => (
                                <div key={i} className="flex items-center gap-3.5 rounded-2xl px-[18px] py-4 border-[1.5px] border-[rgb(10_8_0/8%)] bg-[rgb(10_8_0/3%)] animate-pulse">
                                  <div className="w-10 h-10 rounded-full bg-[rgb(10_8_0/8%)] shrink-0" />
                                  <div className="flex-1 flex flex-col gap-1.5">
                                    <div className="h-3.5 bg-[rgb(10_8_0/8%)] rounded w-1/3" />
                                    <div className="h-2.5 bg-[rgb(10_8_0/6%)] rounded w-1/4" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {barbers.map((barber) => {
                            const isBarberSelected = selectedBarber?.id === barber.id;
                            const nextAvailable = nextAvailableByBarber.get(barber.id);
                            const hasAvailabilityData = barberWeekly.some((w) => w.professional_id === barber.id);
                            return (
                              <button
                                key={barber.id}
                                type="button"
                                data-testid={`btn:barber-${barber.id}`}
                                className={`flex items-center gap-3.5 rounded-2xl px-[18px] py-4 text-left transition-all duration-250 relative ${isBarberSelected ? "border-[1.5px] border-gold bg-gold shadow-[0_4px_16px_rgb(192_154_90/15%),0_2px_6px_rgb(0_0_0/4%)]" : "bg-white border-[1.5px] border-[rgb(10_8_0/14%)] shadow-[0_1px_3px_rgb(0_0_0/4%)] hover:border-[rgb(10_8_0/24%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                onClick={() => setSelectedBarber(barber)}
                              >
                                <div className="relative flex items-center justify-center shrink-0">
                                  {barber.imageUrl ? (
                                    <img src={barber.imageUrl} alt={barber.name} className={`w-10 h-10 rounded-full object-cover transition-[border-color] duration-250 ${isBarberSelected ? "border-2 border-[rgb(255_255_255/30%)]" : "border-2 border-[rgb(192_154_90/20%)]"}`} />
                                  ) : (
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-playfair text-[15px] font-medium transition-[border-color,background,color] duration-250 ${isBarberSelected ? "border-2 border-[rgb(255_255_255/30%)] bg-[rgb(255_255_255/25%)] text-white" : "border-2 border-[rgb(192_154_90/20%)] bg-[linear-gradient(135deg,rgb(192_154_90/12%),rgb(192_154_90/6%))] text-gold2"}`}>{barber.shortName}</div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm font-semibold mb-px tracking-[-0.01em] leading-snug ${isBarberSelected ? "text-white" : "text-brand-black"}`}>{barber.name.split(" ")[0]}</div>
                                  <div className={`text-[11px] font-medium tracking-[0.02em] uppercase ${isBarberSelected ? "text-[rgb(255_255_255/70%)]" : "text-[rgb(10_8_0/55%)]"}`}>{barber.role}</div>
                                </div>
                                {hasAvailabilityData && (
                                  <div className="flex flex-col items-end shrink-0 pl-2">
                                    <span className={`text-[9px] font-semibold tracking-[0.12em] uppercase ${isBarberSelected ? "text-[rgb(255_255_255/60%)]" : "text-[rgb(10_8_0/40%)]"}`}>Next</span>
                                    {nextAvailable ? (
                                      <span className={`text-[12px] font-semibold tracking-[-0.01em] leading-tight ${isBarberSelected ? "text-white" : "text-brand-black"}`}>
                                        {nextAvailable.shortDay} {nextAvailable.displayDate}
                                      </span>
                                    ) : (
                                      <span className={`text-[11px] font-medium ${isBarberSelected ? "text-[rgb(255_255_255/70%)]" : "text-[rgb(10_8_0/45%)]"}`}>Unavailable</span>
                                    )}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {step === 3 && (
                      <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[rgb(10_8_0/15%)] [&::-webkit-scrollbar-thumb]:rounded-sm -mx-5 px-5">
                          <div className="flex flex-col gap-2 pb-24">
                            {(selectedBarber?.services ?? []).length === 0 && !isLoadingServices && (
                              <p className="text-[12px] text-[rgb(10_8_0/45%)] text-center py-4">This barber has no services listed yet.</p>
                            )}
                            {isLoadingServices && (selectedBarber?.services ?? []).length === 0 && (
                              <div className="flex flex-col gap-2">
                                {[1,2,3].map((i) => (
                                  <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3.5 border-[1.5px] border-[rgb(10_8_0/8%)] bg-[rgb(10_8_0/3%)] animate-pulse">
                                    <div className="flex flex-col gap-1.5 w-2/3">
                                      <div className="h-4 bg-[rgb(10_8_0/8%)] rounded w-3/4" />
                                      <div className="h-3 bg-[rgb(10_8_0/6%)] rounded w-1/3" />
                                    </div>
                                    <div className="h-4 bg-[rgb(10_8_0/8%)] rounded w-16" />
                                  </div>
                                ))}
                              </div>
                            )}
                            {(selectedBarber?.services ?? []).map((service) => {
                              const isServiceSelected = selectedServices.some((s) => s.id === service.id);
                              return (
                                <button
                                  key={service.id}
                                  type="button"
                                  data-testid={`btn:service-${service.id}`}
                                  className={`flex items-center justify-between rounded-xl px-4 py-3.5 transition-all duration-250 ${isServiceSelected ? "border-[1.5px] border-gold bg-gold shadow-[0_2px_8px_rgb(192_154_90/10%)]" : "border-[1.5px] border-[rgb(10_8_0/14%)] bg-white shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/24%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                  onClick={() => step === 3 && toggleService(service)}
                                >
                                  <div className="flex flex-col gap-0.5 items-start">
                                      <div className={`text-sm font-semibold tracking-[-0.01em] text-left ${isServiceSelected ? "text-white" : "text-brand-black"}`}>{service.name}</div>
                                      <div className={`text-[11px] font-medium text-left ${isServiceSelected ? "text-[rgb(255_255_255/70%)]" : "text-[rgb(10_8_0/40%)]"}`}>{service.duration} min</div>
                                    </div>
                                  <span className={`text-[15px] font-bold tracking-[-0.02em] ${isServiceSelected ? "text-white" : "text-brand-black"}`}>{service.price} MAD</span>
                                </button>
                              );
                            })}
                          </div>

                          {effectiveSelectedServices.length === 0 && (selectedBarber?.services ?? []).length > 1 && !isLoadingServices && (
                            <p className="text-[11px] text-[rgb(10_8_0/45%)] text-center py-3">
                              Pick one or more services, then tap Continue.
                            </p>
                          )}
                        </div>

                        <AnimatePresence>
                          {effectiveSelectedServices.length > 0 && (
                            <motion.div
                              key="service-cta"
                              initial={{ y: 80, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: 80, opacity: 0 }}
                              transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", damping: 26, stiffness: 260 }}
                              className="shrink-0 px-5 pt-3 pb-5 bg-[#fafaf8] border-t border-[rgb(10_8_0/8%)]"
                            >
                              <button
                                type="button"
                                data-testid="btn:services-continue"
                                onClick={advanceStep}
                                className="w-full bg-brand-black text-white text-[11px] font-semibold tracking-[0.1em] uppercase px-6 py-3.5 rounded-[10px] flex items-center justify-between gap-3 transition-[background,transform,box-shadow] duration-200 shadow-[0_2px_8px_rgb(0_0_0/12%)] border-none hover:bg-ink hover:-translate-y-px hover:shadow-[0_6px_20px_rgb(0_0_0/18%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                              >
                                <span>
                                  Continue
                                  <span className="opacity-60 normal-case tracking-normal ml-2 font-medium">
                                    {effectiveSelectedServices.length} service{effectiveSelectedServices.length > 1 ? "s" : ""}
                                  </span>
                                </span>
                                <span className="font-bold tracking-[-0.01em]">
                                  {effectiveSelectedServices.reduce((s, x) => s + x.price, 0)} MAD
                                </span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {step === 4 && (
                      <>
                        
                        <div className="flex flex-col gap-6">
                          <div className="flex flex-col">
                            <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)] mb-3 flex items-center gap-1.5">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                                <rect x="3" y="4" width="18" height="18" rx="2" />
                                <path d="M16 2v4M8 2v4M3 10h18" />
                              </svg>
                              Select Date
                            </div>

                            {!calendarExpanded && (
                              <div className="flex items-stretch gap-1.5">
                                {currentWeekDays.map((day) => {
                                  const isDateSelected = selectedDate?.id === day.dateStr;
                                  return (
                                    <button
                                      key={day.dateStr}
                                      type="button"
                                      data-testid={`btn:date-${day.dateStr}`}
                                      disabled={day.isPast || !day.isAvailable}
                                      onClick={() => {
                                        if (day.isAvailable) {
                                          const slot = dateSlots.find((s) => s.id === day.dateStr);
                                          if (slot) setSelectedDate(slot);
                                        }
                                      }}
                                      className={`flex-1 flex flex-col items-center justify-center rounded-xl py-2.5 transition-all duration-250 ${
                                        isDateSelected
                                          ? "border-[1.5px] border-gold bg-gold shadow-[0_4px_12px_rgb(192_154_90/25%)]"
                                          : day.isPast || day.isFriday
                                          ? "border-[1.5px] border-[rgb(10_8_0/9%)] bg-[rgb(10_8_0/2%)] cursor-not-allowed"
                                          : day.isAvailable
                                          ? "border-[1.5px] border-[rgb(10_8_0/14%)] bg-white shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/24%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)] cursor-pointer"
                                          : "border-[1.5px] border-[rgb(10_8_0/9%)] bg-[rgb(10_8_0/2%)] cursor-not-allowed"
                                      } focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                    >
                                      <span className={`text-lg font-bold tracking-[-0.02em] leading-none ${
                                        isDateSelected ? "text-white" : day.isPast || day.isFriday || !day.isAvailable ? "text-[rgb(10_8_0/18%)] line-through" : "text-brand-black"
                                      }`}>{day.date}</span>
                                      <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] mt-1 ${
                                        isDateSelected ? "text-[rgb(255_255_255/80%)]" : day.isPast || day.isFriday || !day.isAvailable ? "text-[rgb(10_8_0/22%)]" : "text-[rgb(10_8_0/40%)]"
                                      }`}>{day.shortDay}</span>
                                    </button>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => setCalendarExpanded(true)}
                                  className="flex-1 flex flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-[rgb(10_8_0/18%)] bg-white transition-all duration-250 hover:border-[rgb(10_8_0/28%)] hover:bg-[rgb(10_8_0/2%)] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                                >
                                  <svg viewBox="0 0 12 6" width="13" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[rgb(10_8_0/30%)]">
                                    <path d="M1 1l5 4 5-4" />
                                  </svg>
                                </button>
                              </div>
                            )}

                            <div className={`grid transition-[grid-template-rows] duration-350 ease-out ${calendarExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                              <div className="overflow-hidden">
                                <div className="pt-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[13px] font-semibold text-brand-black tracking-[-0.01em]">{monthYearLabel}</span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={goPrevMonth}
                                        disabled={!canGoPrevMonth}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-200 ${canGoPrevMonth ? "border-[rgb(10_8_0/15%)] text-brand-black hover:border-[rgb(10_8_0/28%)] hover:bg-[rgb(10_8_0/4%)] cursor-pointer" : "border-[rgb(10_8_0/10%)] text-[rgb(10_8_0/20%)] cursor-not-allowed"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                      >
                                        <svg viewBox="0 0 10 16" width="8" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 1L1 8l8 7" /></svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={goNextMonth}
                                        disabled={!canGoNextMonth}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-200 ${canGoNextMonth ? "border-[rgb(10_8_0/15%)] text-brand-black hover:border-[rgb(10_8_0/28%)] hover:bg-[rgb(10_8_0/4%)] cursor-pointer" : "border-[rgb(10_8_0/10%)] text-[rgb(10_8_0/20%)] cursor-not-allowed"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                      >
                                        <svg viewBox="0 0 10 16" width="8" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l8 7-8 7" /></svg>
                                      </button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-7 gap-1 mb-1">
                                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                                      <div key={i} className="text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-[rgb(10_8_0/30%)] py-1">{d}</div>
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-7 gap-1">
                                    {calendarDays.map((day, i) => {
                                      if (!day.isCurrentMonth) {
                                        return (
                                          <div key={i} className="rounded-lg py-2 text-center text-[13px] text-[rgb(10_8_0/12%)]">{day.date}</div>
                                        );
                                      }
                                      const isDateSelected = day.dateStr === selectedDate?.id;
                                      return (
                                        <button
                                          key={i}
                                          type="button"
                                          disabled={!day.isAvailable}
                                          onClick={() => day.isAvailable && handleCalendarDateSelect(day.dateStr)}
                                          className={`rounded-lg py-2 text-center text-[13px] font-semibold transition-all duration-200 ${
                                            isDateSelected
                                              ? "border-[1.5px] border-gold bg-gold text-white shadow-[0_4px_12px_rgb(192_154_90/25%)]"
                                              : day.isAvailable
                                              ? "border-[1.5px] border-[rgb(10_8_0/14%)] bg-white text-brand-black shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/24%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"
                                              : day.isFriday
                                              ? "border-[1.5px] border-[rgb(10_8_0/9%)] bg-[rgb(10_8_0/2%)] text-[rgb(10_8_0/20%)] line-through cursor-not-allowed"
                                              : "text-[rgb(10_8_0/25%)] cursor-not-allowed"
                                          } focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                        >
                                          {day.date}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col pt-5 border-t border-[rgb(10_8_0/11%)]">
                            <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)] mb-3 flex items-center gap-1.5">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                              </svg>
                              Select Time
                            </div>
                            {selectedDate ? (
                              timeSlotStatuses.length > 0 ? (
                                <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-3">
                                  {timeSlotStatuses.map(({ time: slot, available }) => {
                                    const isTimeSelected = selectedTime === slot;
                                    const baseClass = "rounded-[10px] px-1.5 py-2.5 text-center text-[13px] font-semibold tracking-[-0.01em] transition-all duration-250";
                                    const stateClass = isTimeSelected
                                      ? "border-[1.5px] border-gold bg-gold text-white shadow-[0_4px_12px_rgb(192_154_90/25%)]"
                                      : available
                                      ? "border-[1.5px] border-[rgb(10_8_0/14%)] bg-white text-brand-black shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/24%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"
                                      : "border-[1.5px] border-[rgb(10_8_0/9%)] bg-[rgb(10_8_0/2%)] text-[rgb(10_8_0/25%)] line-through cursor-not-allowed";
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                        data-testid={`btn:time-${slot}`}
                                        disabled={!available}
                                        aria-disabled={!available}
                                        title={!available ? "This time is already booked" : undefined}
                                        className={`${baseClass} ${stateClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                        onClick={() => available && setSelectedTime(slot)}
                                      >
                                        {slot}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[12px] text-[rgb(10_8_0/45%)] text-center py-4">No slots available on this day — try another date.</p>
                              )
                            ) : (
                              <p className="text-[12px] text-[rgb(10_8_0/35%)] text-center py-4">Pick a date first.</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}

{step === 5 && (
                      <div className="flex flex-col h-full">
                        <div className={`flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[rgb(10_8_0/15%)] [&::-webkit-scrollbar-thumb]:rounded-sm -mx-5 px-5${formComplete && !isSubmitting ? "" : " pb-6"}`}>

                          <div className="flex flex-col gap-4 mb-[22px]">
                            <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)] flex items-center gap-1.5">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                              Contact Information
                            </div>
                            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                              <div className="flex flex-col gap-1.5">
                                <label htmlFor="f-first" className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)]">First Name</label>
                                <input
                                  id="f-first"
                                  type="text"
                                  placeholder="Mohamed"
                                  autoComplete="given-name"
                                  value={firstName}
                                  onChange={(event) => setFirstName(event.target.value)}
                                  onBlur={() => setFirstName(firstName.trim())}
                                  className="bg-white border-[1.5px] border-[rgb(10_8_0/14%)] rounded-xl px-4 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/3%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/24%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label htmlFor="f-last" className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)]">Last Name</label>
                                <input
                                  id="f-last"
                                  type="text"
                                  placeholder="Alaoui"
                                  autoComplete="family-name"
                                  value={lastName}
                                  onChange={(event) => setLastName(event.target.value)}
                                  onBlur={() => setLastName(lastName.trim())}
                                  className="bg-white border-[1.5px] border-[rgb(10_8_0/14%)] rounded-xl px-4 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/3%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/24%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5 col-span-2 max-sm:col-span-1">
                                <label htmlFor="f-phone" className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)]">Phone Number</label>
                                <input
                                  id="f-phone"
                                  type="tel"
                                  placeholder="+212 6XX XXX XXX"
                                  autoComplete="tel"
                                  value={phone}
                                  onChange={(event) => setPhone(event.target.value)}
                                  onBlur={() => setPhone(phone.trim())}
                                  className="bg-white border-[1.5px] border-[rgb(10_8_0/14%)] rounded-xl px-4 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/3%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/24%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                                />
                                <p className="text-[10px] text-[rgb(10_8_0/40%)] mt-0.5">Format: +212 6XX XXX XXX or 06XX XXX XXX</p>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-[rgb(10_8_0/45%)] leading-relaxed flex items-start gap-2 px-4 py-3 bg-[rgb(192_154_90/5%)] rounded-xl border border-[rgb(192_154_90/22%)] mb-4">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 shrink-0 mt-px opacity-40 text-gold">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 16v-4M12 8h.01" />
                            </svg>
                            Cash only — pay at your appointment. Cancellations are free; let us know in advance.
                          </div>

                          <div className="bg-white rounded-2xl border border-[rgb(10_8_0/10%)] shadow-[0_1px_3px_rgb(0_0_0/3%)] overflow-hidden">
                            <div className="px-4 py-3 flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-semibold text-brand-black tracking-[-0.01em] truncate">
                                  {selectedBarber?.name ?? "—"}
                                  <span className="text-[rgb(10_8_0/35%)] font-normal"> · </span>
                                  <span className="text-[rgb(10_8_0/60%)] font-medium">{selectedServicesLabel || "—"}</span>
                                </div>
                                <div className="text-[11px] text-[rgb(10_8_0/50%)] mt-0.5 truncate">
                                  {selectedDate?.fullDate ?? "—"}{selectedTime ? ` · ${selectedTime}` : ""}
                                  {selectedLocation ? ` · ${selectedLocation.type === "home" ? "Come to me" : selectedLocation.name}` : ""}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[rgb(10_8_0/40%)] leading-none mb-1">Total</div>
                                <div className="font-playfair text-[19px] font-medium tracking-[-0.02em] text-gold leading-none">{total} MAD</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {formComplete && !isSubmitting && (
                            <motion.div
                              key="details-cta"
                              initial={{ y: 80, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: 80, opacity: 0 }}
                              transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", damping: 26, stiffness: 260 }}
                              className="shrink-0 px-5 pt-3 pb-5 bg-[#fafaf8] border-t border-[rgb(10_8_0/8%)]"
                            >
                              <button
                                type="button"
                                data-testid="btn:confirm-booking"
                                onClick={advanceStep}
                                className="w-full bg-brand-black text-white text-[11px] font-semibold tracking-[0.1em] uppercase px-6 py-3.5 rounded-[10px] flex items-center justify-between gap-3 transition-[background,transform,box-shadow] duration-200 shadow-[0_2px_8px_rgb(0_0_0/12%)] border-none hover:bg-ink hover:-translate-y-px hover:shadow-[0_6px_20px_rgb(0_0_0/18%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                              >
                                <span className="flex items-center gap-2">
                                  {!user && (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/></svg>
                                  )}
                                  {user ? "Confirm Booking" : "Continue with Google"}
                                </span>
                                <span className="font-bold tracking-[-0.01em]">{total} MAD</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {isSubmitting && (
                          <div className="shrink-0 px-5 pt-3 pb-5 bg-[#fafaf8] border-t border-[rgb(10_8_0/8%)]">
                            <button type="button" disabled data-testid="btn:confirm-booking"
                              className="w-full bg-brand-black text-white text-[11px] font-semibold tracking-[0.1em] uppercase px-6 py-3.5 rounded-[10px] flex items-center justify-center gap-2 opacity-70 cursor-not-allowed">
                              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                              {user ? "Saving…" : "Waiting for Google…"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {step === 6 && (
                      <div className="flex flex-col h-full" data-testid="step:booking-confirmed">
                        <div className="flex-1 overflow-y-auto px-1 pt-5 pb-6 text-center">
                          <div className="w-[72px] h-[72px] rounded-full bg-[linear-gradient(135deg,#c09a5a,#d4ae70)] flex items-center justify-center mx-auto mb-6 animate-pop-in shadow-[0_8px_24px_rgb(192_154_90/30%),0_4px_10px_rgb(0_0_0/8%)]">
                            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
                              <svg className="w-6 h-6 stroke-gold fill-none stroke-[2.5] animate-check-draw" viewBox="0 0 24 24">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          </div>
                          <h2 className="font-playfair text-[28px] font-medium text-brand-black mb-2 tracking-[-0.02em]">You&apos;re all set!</h2>
                          <p className="text-[13px] text-[rgb(10_8_0/50%)] leading-[1.7] max-w-[320px] mx-auto mb-6">
                            Your appointment has been received. We&apos;ll reach out to confirm within a few hours.
                          </p>

                          <div className="bg-white rounded-2xl border border-[rgb(10_8_0/10%)] shadow-[0_1px_3px_rgb(0_0_0/3%)] text-left px-4 py-3 mx-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-semibold text-brand-black tracking-[-0.01em] truncate">
                                  {firstName} {lastName}
                                </div>
                                <div className="text-[11px] text-[rgb(10_8_0/50%)] mt-0.5 truncate">
                                  {selectedDate?.fullDate}{selectedTime ? ` · ${selectedTime}` : ""} · {selectedBarber?.name}
                                </div>
                                <div className="text-[11px] text-[rgb(10_8_0/45%)] mt-0.5 truncate">{selectedServicesLabel}</div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[rgb(10_8_0/40%)] leading-none mb-1">Total</div>
                                <div className="font-playfair text-[19px] font-medium tracking-[-0.02em] text-gold leading-none">{total} MAD</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          <motion.div
                            key="confirm-cta"
                            initial={{ y: 80, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 80, opacity: 0 }}
                            transition={{ type: "spring", damping: 26, stiffness: 260, delay: 0.35 }}
                            className="shrink-0 px-5 pt-3 pb-5 bg-[#fafaf8] border-t border-[rgb(10_8_0/8%)]"
                          >
                            <button
                              type="button"
                              onClick={finishBooking}
                              className="w-full bg-brand-black text-white text-[11px] font-semibold tracking-[0.1em] uppercase px-6 py-3.5 rounded-[10px] flex items-center justify-center gap-2 transition-[background,transform,box-shadow] duration-200 shadow-[0_2px_8px_rgb(0_0_0/12%)] border-none hover:bg-ink hover:-translate-y-px hover:shadow-[0_6px_20px_rgb(0_0_0/18%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                            >
                              Close
                            </button>
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence>
                  {showUserPanel && (
                    <UserPanel onClose={() => setShowUserPanel(false)} showToast={(kind, text) => setToast({ kind, text })} />
                  )}
                </AnimatePresence>

                {/* Home Location Panel — slides up from bottom within the content area */}
                <AnimatePresence>
                  {showHomePanel && (
                    <motion.div
                      className="absolute inset-0 bg-[rgb(10_8_0/40%)] [backdrop-filter:blur(3px)] z-[9]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => setShowHomePanel(false)}
                    />
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {showHomePanel && (
                    <motion.div
                      className="absolute inset-x-0 bottom-0 h-3/4 bg-[#fafaf8] rounded-t-[20px] z-10 flex flex-col overflow-hidden shadow-[0_-12px_40px_rgb(0_0_0/18%)]"
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", damping: 28, stiffness: 250 }}
                    >
                      <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0 border-b border-[rgb(10_8_0/11%)]">
                        <div>
                          <h3 className="text-[15px] font-bold text-brand-black tracking-[-0.01em]">Your Location</h3>
                          <p className="text-[11px] text-[rgb(10_8_0/45%)] mt-0.5">Tap the map or drag the pin to your address</p>
                        </div>
                        <button
                          type="button"
                          className="w-8 h-8 rounded-full flex items-center justify-center border border-[rgb(10_8_0/20%)] cursor-pointer transition-[background,border-color] duration-200 hover:bg-[rgb(10_8_0/5%)] hover:border-[rgb(10_8_0/30%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                          onClick={() => setShowHomePanel(false)}
                          aria-label="Close"
                        >
                          <svg viewBox="0 0 10 10" width="10" height="10">
                            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent]">
                        <button
                          type="button"
                          className="self-start flex items-center gap-2 h-8 px-4 rounded-full border border-[rgb(10_8_0/22%)] bg-white text-[11px] font-semibold tracking-[0.05em] uppercase text-brand-black transition-all duration-200 hover:border-[rgb(10_8_0/30%)] hover:bg-[rgb(10_8_0/3%)] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                          onClick={handleHomeMyLocation}
                          disabled={homeLocating}
                        >
                          {homeLocating ? (
                            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              <path d="M3 12a9 9 0 019-9" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="3" />
                              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                            </svg>
                          )}
                          {homeLocating ? "Detecting…" : "Use my location"}
                        </button>

                        <div className="rounded-xl overflow-hidden border border-[rgb(10_8_0/15%)]" style={{ height: 230 }}>
                          {homePin && (
                            <HomePanelMapView
                              lat={homePin.lat}
                              lng={homePin.lng}
                              onMapClick={handleHomeMapClick}
                              onMarkerDrag={handleHomeMarkerDrag}
                            />
                          )}
                        </div>

                        <div className="text-[11px] text-[rgb(10_8_0/45%)] leading-relaxed flex items-start gap-1.5 min-h-[1em]">
                          <svg className="w-3 h-3 shrink-0 mt-px opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>
                            {homePinGeoLoading
                              ? "Resolving address…"
                              : homePinLabel
                              ? homePinLabel
                              : homePin
                              ? `${homePin.lat.toFixed(5)}, ${homePin.lng.toFixed(5)}`
                              : ""}
                          </span>
                        </div>
                      </div>

                      <div className="px-5 pb-5 pt-3 shrink-0 border-t border-[rgb(10_8_0/11%)]">
                        <button
                          type="button"
                          className="w-full bg-brand-black text-white text-[11px] font-semibold tracking-[0.1em] uppercase px-6 py-3.5 rounded-[10px] flex items-center justify-center gap-1.5 transition-[background,transform,box-shadow] duration-200 shadow-[0_2px_8px_rgb(0_0_0/12%)] cursor-pointer border-none hover:bg-ink hover:-translate-y-px hover:shadow-[0_6px_20px_rgb(0_0_0/18%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                          onClick={handleConfirmHomeLocation}
                        >
                          Save Location
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
