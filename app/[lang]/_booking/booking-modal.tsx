"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReverseGeocode } from "@/hooks/use-reverse-geocode";
import { useT } from "@/lib/i18n/client-dictionary";
import { formatMoney, formatTimeFromHHMM, formatShortMonth, formatShortWeekday } from "@/lib/i18n/format";
import {
  getActiveSalons,
  getAllProfessionalsAvailability,
  getAllAvailabilityOverrides,
  getBookedSlots,
  getBookedSlotsInRange,
  createAppointment,
  updateProfile,
  getCurrentProfile,
} from "@/lib/queries";
import type { Salon, ProfessionalAvailability, AvailabilityOverride, PaymentMethod } from "@/lib/types/database";
import type { Locale } from "@/lib/i18n/config";
import { getPublicPaymentConfig } from "@/lib/queries/payment-settings";
import { useAuth } from "@/lib/auth-context";
import { MenuAvatarButton } from "@/components/user-panel/menu-avatar-button";
import { UserPanel } from "@/components/user-panel/user-panel";
import { buildTimeSlots, buildTimeSlotsWithStatus, getWorkingHoursForDate, toMinutes, toHHMM, toHHMMSS, SLOT_STEP_MINUTES } from "@/lib/booking/slots";
import { buildDateSlots, BOOKING_WINDOW_DAYS, type DateSlot } from "@/lib/booking/date-slots";
import type { BarberOption, ServiceOption, LocationOption, BookingDraft } from "./types";

const HOME_LOCATION: LocationOption = {
  id: "home",
  name: "",
  description: "",
  imageUrl: null,
  type: "home",
};

const HomePanelMapView = dynamic(
  () => import("@/components/map-view").then((mod) => ({ default: mod.MapView })),
  { ssr: false }
);

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatRib(rib: string): string {
  return rib.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export interface BookingModalProps {
  barbers: BarberOption[];
  isModalOpen: boolean;
  isLoadingBarbers: boolean;
  isLoadingServices: boolean;
  locale: Locale;
  onClose: () => void;
}

export function BookingModal({ barbers, isModalOpen, isLoadingBarbers, isLoadingServices, locale, onClose }: BookingModalProps) {
  const tBooking = useT("booking");
  const tCommon = useT("common");

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentConfig, setPaymentConfig] = useState<Awaited<ReturnType<typeof getPublicPaymentConfig>> | null>(null);
  const [copiedField, setCopiedField] = useState<{ accountId: string; field: "rib" | "iban" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string; testid?: string } | null>(null);
  const [isLoadingSalons, setIsLoadingSalons] = useState(true);
  const [salons, setSalons] = useState<LocationOption[]>([]);

  const prefersReducedMotion = useReducedMotion();
  const { user, signInWithGoogleModal, verifyUser } = useAuth();
  const submitTimerRef = useRef<number | null>(null);
  const prefilledRef = useRef({ firstName: "", lastName: "", phone: "" });

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

  const visibleBarbers = useMemo(
    () =>
      selectedLocation?.type === "home"
        ? barbers.filter((b) => b.offersHomeVisit)
        : barbers,
    [barbers, selectedLocation]
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
      const barberServiceIds = new Set(barber.services.map((s) => s.id));
      const compatibleDuration = selectedServices
        .filter((s) => barberServiceIds.has(s.id))
        .reduce((sum, s) => sum + s.duration, 0);
      const maxBarberServiceDuration = barber.services.length > 0
        ? Math.max(...barber.services.map((s) => s.duration))
        : SLOT_STEP_MINUTES;
      const durationToCheck = compatibleDuration > 0 ? compatibleDuration : maxBarberServiceDuration;
      const found = dateSlots.find((slot) => {
        const hours = getWorkingHoursForDate(slot.id, weekly, overrides);
        if (!hours) return false;
        const booked = bookingsByBarberDate.get(`${barber.id}:${slot.id}`) ?? [];
        return buildTimeSlots(hours, durationToCheck, booked).length > 0;
      }) ?? null;
      map.set(barber.id, found);
    }
    return map;
  }, [barbers, barberWeekly, barberOverrides, dateSlots, bookingsByBarberDate, selectedServices]);

  const { label: homePinLabel, loading: homePinGeoLoading } = useReverseGeocode(
    homePin?.lat ?? null,
    homePin?.lng ?? null
  );

  useEffect(() => {
    const { body, documentElement: html } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    return () => {
      body.style.overflow = prevBodyOverflow;
      html.style.overflow = prevHtmlOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
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

  useEffect(() => {
    setIsLoadingSalons(true);
    getActiveSalons(locale as import("@/lib/i18n/config").Locale)
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
  }, [locale]);

  const currentWeekDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const mondayOffset = dow === 0 ? 1 : dow === 1 ? 0 : -(dow - 1);
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const days: {
      date: number;
      dateStr: string;
      shortDay: string;
      monthStr: string;
      isPast: boolean;
      isAvailable: boolean;
      isFriday: boolean;
      isSelected: boolean;
    }[] = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const isPast = d < today;
      const isAvailable = !isPast && availableDateIds.has(dateStr);
      days.push({
        date: d.getDate(),
        dateStr,
        shortDay: formatShortWeekday(d, locale as import("@/lib/i18n/config").Locale),
        monthStr: formatShortMonth(d, locale as import("@/lib/i18n/config").Locale),
        isPast,
        isAvailable,
        isFriday: !isPast && !isAvailable,
        isSelected: false,
      });
    }
    return days;
  }, [availableDateIds]);

  const monthYearLabel = `${formatShortMonth(new Date(calendarMonth.year, calendarMonth.month, 1), locale as import("@/lib/i18n/config").Locale)} ${calendarMonth.year}`;

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
        const distances: Record<string, number> = {};
        rawSalons.forEach((s) => {
          distances[s.id] = haversineKm(latitude, longitude, s.latitude, s.longitude);
        });
        setSalonDistances(distances);
        const sorted = [...rawSalons].sort((a, b) => distances[a.id] - distances[b.id]);
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
        setToast({ kind: "error", text: tBooking("toast.locationDenied") });
        setNearbyLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [nearbyActive, rawSalons, tBooking]);

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
  }, []);

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

  const handleCloseModal = () => {
    setShowHomePanel(false);
    onClose();
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (!isModalOpen) return;
      if (event.key === "Escape") {
        if (showHomePanel) {
          setShowHomePanel(false);
          return;
        }
        if (showUserPanel) {
          setShowUserPanel(false);
          return;
        }
        handleCloseModal();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showHomePanel, showUserPanel]);

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
    setPaymentMethod("cash");
    setPaymentConfig(null);
    setCopiedField(null);
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
    handleCloseModal();
    resetBooking();
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
      paymentMethod,
    };
  }, [selectedBarber, selectedDate, effectiveSelectedTime, selectedLocation, effectiveSelectedServices, homePin, homePinLabel, firstName, lastName, phone, total, totalDurationMinutes, paymentMethod]);

  const persistAppointment = useCallback(
    async (draft: BookingDraft, customerId: string) => {
      await updateProfile({
        id: customerId,
        first_name: draft.firstName,
        last_name: draft.lastName,
        phone: draft.phone,
        locale,
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
          payment_method: draft.paymentMethod,
          status: "pending",
          total_price_mad: draft.totalPrice,
          notes: null,
        },
        draft.serviceIds
      );

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
    },
    [barbers, locale]
  );

  const advanceStep = async () => {
    if (isSubmitting) return;

    if (step === 5) {
      if (!formComplete) return;
      const draft = buildDraft();
      if (!draft) return;

      const phoneRegex = /^(?:\+?212|0)\s?[5-7](?:[\s-]?\d){8}$/;
      if (!phoneRegex.test(phone.trim())) {
        setToast({ kind: "error", text: tBooking("validation.phoneInvalid") });
        return;
      }

      if (
        paymentMethod === "bank_transfer" &&
        (!paymentConfig?.bank_transfer_enabled || paymentConfig.accounts.length === 0)
      ) {
        setToast({ kind: "error", text: tBooking("validation.bankTransferUnavailable") });
        return;
      }

      setIsSubmitting(true);
      try {
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
        if (err instanceof Error && err.message === "SLOT_TAKEN") {
          setToast({ kind: "error", text: tBooking("validation.slotTaken"), testid: "text:booking-error" });
          setBookedSlots(null);
          if (selectedBarber && selectedDate) {
            const refreshed = await getBookedSlots(selectedBarber.id, selectedDate.id);
            const key = `${selectedBarber.id}:${selectedDate.id}`;
            setBookedSlots({ key, slots: refreshed });
          }
        } else {
          const message =
            err instanceof Error && err.message ? err.message : tBooking("validation.saveFailed");
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
    getPublicPaymentConfig()
      .then((config) => setPaymentConfig(config))
      .catch(() => setPaymentConfig(null));
  }, []);

  useEffect(() => {
    if (
      paymentMethod === "bank_transfer" &&
      paymentConfig !== null &&
      (!paymentConfig.bank_transfer_enabled || paymentConfig.accounts.length === 0)
    ) {
      setPaymentMethod("cash");
    }
  }, [paymentConfig, paymentMethod]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getCurrentProfile()
      .then((profile) => {
        if (cancelled || !profile) return;
        if (profile.first_name) {
          setFirstName((prev) => {
            if (prev !== "") return prev;
            prefilledRef.current.firstName = profile.first_name!.trim();
            return profile.first_name!.trim();
          });
        }
        if (profile.last_name) {
          setLastName((prev) => {
            if (prev !== "") return prev;
            prefilledRef.current.lastName = profile.last_name!.trim();
            return profile.last_name!.trim();
          });
        }
        if (profile.phone) {
          setPhone((prev) => {
            if (prev !== "") return prev;
            prefilledRef.current.phone = profile.phone!.trim();
            return profile.phone!.trim();
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
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
  }, [canContinue, step, formComplete, advanceStep]);

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
    setSelectedTime(null);
  }, [selectedDate?.id]);

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
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          className="fixed inset-0 z-[500] flex items-end justify-end p-5 pointer-events-none bg-[rgb(10_8_0/35%)] [backdrop-filter:blur(4px)] max-sm:p-0 max-sm:bg-[#fafaf8] max-sm:[backdrop-filter:none] max-sm:items-stretch max-sm:justify-stretch"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              if (step >= 5) return;
              handleCloseModal();
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
                    toast.kind === "success" ? "bg-[#c09a5a] text-white" : "bg-red-600 text-white"
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
                  aria-label={tBooking("misc.goBack")}
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
                  {step === 1 && tBooking("steps.location.title")}
                  {step === 2 && tBooking("steps.barber.title")}
                  {step === 3 && tBooking("steps.service.title")}
                  {step === 4 && tBooking("steps.time.title")}
                  {step === 5 && tBooking("steps.details.title")}
                  {step === 6 && tBooking("steps.confirmation.title")}
                </motion.p>
              </AnimatePresence>
            </div>
            <MenuAvatarButton onClick={() => setShowUserPanel(true)} />
            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-none border border-[rgb(10_8_0/20%)] cursor-pointer text-brand-black transition-[background,border-color] duration-200 shrink-0 p-0 hover:bg-[rgb(10_8_0/5%)] hover:border-[rgb(10_8_0/30%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
              onClick={() => {
                if (
                  step === 5 &&
                  (firstName.trim() !== prefilledRef.current.firstName.trim() ||
                    lastName.trim() !== prefilledRef.current.lastName.trim() ||
                    phone.trim() !== prefilledRef.current.phone.trim())
                ) {
                  if (!window.confirm(tBooking("steps.details.discardConfirm"))) return;
                }
                handleCloseModal();
              }}
              aria-label={tCommon("close")}
            >
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
                      <button
                        type="button"
                        onClick={handleNearby}
                        disabled={nearbyLocating}
                        className={`flex items-center justify-center h-8 px-3 mr-3 rounded-full border uppercase text-[11px] font-semibold tracking-[0.05em] transition-all duration-200 ${
                          nearbyActive
                            ? "border-gold bg-gold text-white"
                            : nearbyLocating
                            ? "border-[rgb(10_8_0/22%)] bg-white text-black cursor-wait"
                            : "border-[rgb(10_8_0/22%)] bg-white text-black hover:border-[rgb(10_8_0/30%)] hover:bg-[rgb(10_8_0/3%)]"
                        } focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                      >
                        {nearbyLocating ? (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="mr-1.5 animate-spin opacity-60"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path
                              d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                              strokeLinecap="round"
                            />
                          </svg>
                        ) : (
                          <svg
                            width="10"
                            height="12"
                            viewBox="0 0 10 12"
                            fill="none"
                            className={`mr-1.5 ${nearbyActive ? "opacity-80" : "opacity-60"}`}
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <path d="M5 0C2.79 0 1 1.79 1 4c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" />
                            <circle cx="5" cy="4" r="1.5" />
                          </svg>
                        )}
                        {tBooking("steps.location.nearby")}
                      </button>
                      <button
                        type="button"
                        className={`flex items-center justify-center h-8 px-3 mr-3 rounded-full border uppercase text-[11px] font-semibold tracking-[0.05em] transition-all duration-200 ${
                          showHomePanel
                            ? "border-gold bg-gold text-white"
                            : "border-[rgb(10_8_0/22%)] bg-white text-black hover:border-[rgb(10_8_0/30%)] hover:bg-[rgb(10_8_0/3%)]"
                        } focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                        onClick={openHomePanel}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-1.5 opacity-60"
                        >
                          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        {tBooking("steps.location.comeToMe")}
                      </button>
                    </div>
                    {isLoadingSalons && salons.length === 0 && (
                      <div className="grid grid-cols-1 gap-2.5 mb-4">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3.5 rounded-2xl px-[18px] py-3.5 border-[1.5px] border-[rgb(10_8_0/8%)] bg-[rgb(10_8_0/3%)] animate-pulse"
                          >
                            <div className="shrink-0 w-[107px] h-[107px] rounded-[10px] bg-[rgb(10_8_0/8%)]" />
                            <div className="flex-1 flex flex-col gap-2 mt-2">
                              <div className="h-4 bg-[rgb(10_8_0/8%)] rounded w-3/4" />
                              <div className="h-3 bg-[rgb(10_8_0/6%)] rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div
                      className={`grid grid-cols-1 gap-2.5 transition-opacity ${
                        nearbyLocating ? "animate-pulse pointer-events-none" : ""
                      }`}
                    >
                      {salons.map((location) => {
                        const isLocationSelected = selectedLocation?.id === location.id;
                        return (
                          <button
                            key={location.id}
                            type="button"
                            data-testid={`btn:location-${location.id}`}
                            className={`flex items-start gap-3.5 rounded-2xl px-[18px] py-3.5 text-left transition-all duration-200 relative ${
                              isLocationSelected
                                ? "border-[1.5px] border-gold bg-gold"
                                : "border-[1.5px] border-[rgb(10_8_0/14%)] bg-white shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/24%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"
                            } focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                            onClick={() => setSelectedLocation(location)}
                          >
                            {location.imageUrl ? (
                              <img
                                src={location.imageUrl}
                                alt={location.name}
                                className={`shrink-0 w-[107px] h-[107px] rounded-[10px] object-cover transition-[border-color] duration-200 ${
                                  isLocationSelected ? "border-2 border-[rgb(255_255_255/30%)]" : "border-2 border-[rgb(192_154_90/20%)]"
                                }`}
                              />
                            ) : (
                              <div
                                className={`relative flex items-center justify-center shrink-0 w-[107px] h-[107px] rounded-[10px] ${
                                  isLocationSelected ? "bg-[rgb(255_255_255/25%)]" : "bg-[rgb(10_8_0/4%)]"
                                }`}
                              >
                                <svg
                                  className={`w-12 h-12 transition-[opacity,color] duration-200 ${
                                    isLocationSelected ? "opacity-100 text-white" : "opacity-70 text-brand-black"
                                  }`}
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="0.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M5 2.5l2-1.5h10l2 1.5" />
                                  <rect x="2" y="2.5" width="20" height="2.5" />
                                  <rect x="1" y="5" width="22" height="3" />
                                  <text x="12" y="7.2" textAnchor="middle" fontSize="4" fontWeight="bold" fill="currentColor" stroke="none">
                                    SALON
                                  </text>
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
                              <div
                                className={`text-[17px] font-semibold leading-snug tracking-[-0.408px] mb-0.5 truncate ${
                                  isLocationSelected ? "text-white" : "text-brand-black"
                                }`}
                              >
                                {location.id === "home" ? tBooking("steps.location.comeToMe") : location.name}
                              </div>
                              <div
                                className={`text-[13px] leading-[18px] tracking-[-0.078px] font-normal line-clamp-2 ${
                                  isLocationSelected ? "text-[rgb(255_255_255/70%)]" : "text-[rgb(10_8_0/55%)]"
                                }`}
                              >
                                {location.id === "home" ? tBooking("hero.locationDescription") : location.description}
                              </div>
                              {nearbyActive && salonDistances[location.id] != null && (
                                <div className="mt-2">
                                  <div className="w-[30px] border-t border-[rgb(199_199_204)] mb-1" />
                                  <p
                                    data-testid="text:distance"
                                    className={`text-[15px] leading-[18px] tracking-[-0.24px] ${
                                      isLocationSelected ? "text-[rgb(255_255_255/80%)]" : "text-[rgb(10_8_0/55%)]"
                                    }`}
                                  >
                                    {salonDistances[location.id] < 1
                                      ? `${(salonDistances[location.id] * 1000).toFixed(0)} m`
                                      : `${salonDistances[location.id].toFixed(2)} Km`}
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
                      {isLoadingBarbers ? (
                        <>
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-3.5 rounded-2xl px-[18px] py-4 bg-white border border-[rgb(10_8_0/14%)] shadow-[0_1px_3px_rgb(0_0_0/4%)]">
                              <div className="w-10 h-10 rounded-full bg-[rgb(10_8_0/8%)]" />
                              <div className="flex-1 min-w-0">
                                <div className="h-3 w-24 rounded bg-[rgb(10_8_0/8%)] mb-2" />
                                <div className="h-2.5 w-16 rounded bg-[rgb(10_8_0/6%)]" />
                              </div>
                            </div>
                          ))}
                        </>
                      ) : visibleBarbers.length === 0 ? (
                          <p className="text-[13px] text-[rgb(10_8_0/55%)] text-center py-8">
                            {tBooking("steps.barber.noHomeBarbers")}
                          </p>
                        ) : visibleBarbers.map((barber) => {
                          const isBarberSelected = selectedBarber?.id === barber.id;
                          const nextAvailable = nextAvailableByBarber.get(barber.id);
                          const hasAvailabilityData = barberWeekly.some((w) => w.professional_id === barber.id);
                          return (
                            <button
                              key={barber.id}
                              type="button"
                              data-testid={`btn:barber-${barber.id}`}
                              className={`flex items-center gap-3.5 rounded-2xl px-[18px] py-4 text-left transition-all duration-250 relative ${
                                isBarberSelected
                                  ? "border-[1.5px] border-gold bg-gold shadow-[0_4px_16px_rgb(192_154_90/15%),0_2px_6px_rgb(0_0_0/4%)]"
                                  : "bg-white border-[1.5px] border-[rgb(10_8_0/14%)] shadow-[0_1px_3px_rgb(0_0_0/4%)] hover:border-[rgb(10_8_0/24%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"
                              } focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                              onClick={() => setSelectedBarber(barber)}
                            >
                            <div className="relative flex items-center justify-center shrink-0">
                              {barber.imageUrl ? (
                                <img
                                  src={barber.imageUrl}
                                  alt={barber.name}
                                  className={`w-10 h-10 rounded-full object-cover transition-[border-color] duration-250 ${
                                    isBarberSelected ? "border-2 border-[rgb(255_255_255/30%)]" : "border-2 border-[rgb(192_154_90/20%)]"
                                  }`}
                                />
                              ) : (
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center font-playfair text-[15px] font-medium transition-[border-color,background,color] duration-250 ${
                                    isBarberSelected
                                      ? "border-2 border-[rgb(255_255_255/30%)] bg-[rgb(255_255_255/25%)] text-white"
                                      : "border-2 border-[rgb(192_154_90/20%)] bg-[linear-gradient(135deg,rgb(192_154_90/12%),rgb(192_154_90/6%))] text-gold2"
                                  }`}
                                >
                                  {barber.shortName}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div
                                className={`text-sm font-semibold mb-px tracking-[-0.01em] leading-snug ${
                                  isBarberSelected ? "text-white" : "text-brand-black"
                                }`}
                              >
                                {barber.name.split(" ")[0]}
                              </div>
                              <div
                                className={`text-[11px] font-medium tracking-[0.02em] uppercase ${
                                  isBarberSelected ? "text-[rgb(255_255_255/70%)]" : "text-[rgb(10_8_0/55%)]"
                                }`}
                              >
                                {barber.role}
                              </div>
                            </div>
                            {hasAvailabilityData && (
                              <div className="flex flex-col items-end shrink-0 pl-2">
                                <span
                                  className={`text-[9px] font-semibold tracking-[0.12em] uppercase ${
                                    isBarberSelected ? "text-[rgb(255_255_255/60%)]" : "text-[rgb(10_8_0/40%)]"
                                  }`}
                                >
                                  Next
                                </span>
                                {nextAvailable ? (
                                  <span
                                    className={`text-[12px] font-semibold tracking-[-0.01em] leading-tight ${
                                      isBarberSelected ? "text-white" : "text-brand-black"
                                    }`}
                                  >
                                    {nextAvailable.shortDay} {nextAvailable.displayDate}
                                  </span>
                                ) : (
                                  <span
                                    className={`text-[11px] font-medium ${
                                      isBarberSelected ? "text-[rgb(255_255_255/70%)]" : "text-[rgb(10_8_0/45%)]"
                                    }`}
                                  >
                                    {tBooking("steps.barber.unavailable")}
                                  </span>
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
                        {isLoadingServices ? (
                          <>
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3.5 bg-white border border-[rgb(10_8_0/14%)] shadow-[0_1px_2px_rgb(0_0_0/3%)]">
                                <div className="flex flex-col gap-0.5">
                                  <div className="h-3 w-32 rounded bg-[rgb(10_8_0/8%)]" />
                                  <div className="h-2.5 w-16 rounded bg-[rgb(10_8_0/6%)]" />
                                </div>
                                <div className="h-4 w-12 rounded bg-[rgb(10_8_0/8%)]" />
                              </div>
                            ))}
                          </>
                        ) : (
                          <>
                            {(selectedBarber?.services ?? []).length === 0 && (
                              <p className="text-[12px] text-[rgb(10_8_0/45%)] text-center py-4">
                                {tBooking("steps.service.thisBarberNoServices")}
                              </p>
                            )}
                            {(selectedBarber?.services ?? []).map((service) => {
                              const isServiceSelected = selectedServices.some((s) => s.id === service.id);
                              return (
                                <button
                                  key={service.id}
                                  type="button"
                                  data-testid={`btn:service-${service.id}`}
                                  className={`flex items-center justify-between rounded-xl px-4 py-3.5 transition-all duration-250 ${
                                    isServiceSelected
                                      ? "border-[1.5px] border-gold bg-gold shadow-[0_2px_8px_rgb(192_154_90/10%)]"
                                      : "border-[1.5px] border-[rgb(10_8_0/14%)] bg-white shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/24%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"
                                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                  onClick={() => step === 3 && toggleService(service)}
                                >
                                  <div className="flex flex-col gap-0.5 items-start">
                                    <div
                                      className={`text-sm font-semibold tracking-[-0.01em] text-left ${
                                        isServiceSelected ? "text-white" : "text-brand-black"
                                      }`}
                                    >
                                      {service.name}
                                    </div>
                                    <div
                                      className={`text-[11px] font-medium text-left ${
                                        isServiceSelected ? "text-[rgb(255_255_255/70%)]" : "text-[rgb(10_8_0/40%)]"
                                      }`}
                                    >
                                      {service.duration} min
                                    </div>
                                  </div>
                                  <span
                                    className={`text-[15px] font-bold tracking-[-0.02em] ${
                                      isServiceSelected ? "text-white" : "text-brand-black"
                                    }`}
                                  >
                                    {formatMoney(service.price, locale as import("@/lib/i18n/config").Locale)}
                                  </span>
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>

                      {effectiveSelectedServices.length === 0 && (selectedBarber?.services ?? []).length > 1 && (
                        <p className="text-[11px] text-[rgb(10_8_0/45%)] text-center py-3">
                          {tBooking("steps.service.pickOneOrMore")}
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
                              {tBooking("steps.service.continue")}
                              <span className="opacity-60 normal-case tracking-normal ml-2 font-medium">
                                ({effectiveSelectedServices.length === 1
                                  ? tBooking("steps.service.services_one")
                                  : tBooking("steps.service.services_other", { count: effectiveSelectedServices.length })}
                                )
                              </span>
                            </span>
                            <span className="font-bold tracking-[-0.01em]">
                              {formatMoney(
                                effectiveSelectedServices.reduce((s, x) => s + x.price, 0),
                                locale as import("@/lib/i18n/config").Locale
                              )}
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
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-60"
                          >
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M16 2v4M8 2v4M3 10h18" />
                          </svg>
                          {tBooking("steps.time.selectDate")}
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
                                  <span
                                    className={`text-lg font-bold tracking-[-0.02em] leading-none ${
                                      isDateSelected
                                        ? "text-white"
                                        : day.isPast || day.isFriday || !day.isAvailable
                                        ? "text-[rgb(10_8_0/18%)] line-through"
                                        : "text-brand-black"
                                    }`}
                                  >
                                    {day.date}
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold uppercase tracking-[0.08em] mt-1 ${
                                      isDateSelected
                                        ? "text-[rgb(255_255_255/80%)]"
                                        : day.isPast || day.isFriday || !day.isAvailable
                                        ? "text-[rgb(10_8_0/22%)]"
                                        : "text-[rgb(10_8_0/40%)]"
                                    }`}
                                  >
                                    {day.shortDay}
                                  </span>
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setCalendarExpanded(true)}
                              className="flex-1 flex flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-[rgb(10_8_0/18%)] bg-white transition-all duration-250 hover:border-[rgb(10_8_0/28%)] hover:bg-[rgb(10_8_0/2%)] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                            >
                              <svg
                                viewBox="0 0 12 6"
                                width="13"
                                height="7"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-[rgb(10_8_0/30%)]"
                              >
                                <path d="M1 1l5 4 5-4" />
                              </svg>
                            </button>
                          </div>
                        )}

                        <div
                          className={`grid transition-[grid-template-rows] duration-350 ease-out ${
                            calendarExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="pt-1">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[13px] font-semibold text-brand-black tracking-[-0.01em]">
                                  {monthYearLabel}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={goPrevMonth}
                                    disabled={!canGoPrevMonth}
                                    className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-200 ${
                                      canGoPrevMonth
                                        ? "border-[rgb(10_8_0/15%)] text-brand-black hover:border-[rgb(10_8_0/28%)] hover:bg-[rgb(10_8_0/4%)] cursor-pointer"
                                        : "border-[rgb(10_8_0/10%)] text-[rgb(10_8_0/20%)] cursor-not-allowed"
                                    } focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                  >
                                    <svg
                                      viewBox="0 0 10 16"
                                      width="8"
                                      height="13"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M9 1L1 8l8 7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={goNextMonth}
                                    disabled={!canGoNextMonth}
                                    className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-200 ${
                                      canGoNextMonth
                                        ? "border-[rgb(10_8_0/15%)] text-brand-black hover:border-[rgb(10_8_0/28%)] hover:bg-[rgb(10_8_0/4%)] cursor-pointer"
                                        : "border-[rgb(10_8_0/10%)] text-[rgb(10_8_0/20%)] cursor-not-allowed"
                                    } focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                  >
                                    <svg
                                      viewBox="0 0 10 16"
                                      width="8"
                                      height="13"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M1 1l8 7-8 7" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-7 gap-1 mb-1">
                                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                                  <div key={i} className="text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-[rgb(10_8_0/30%)] py-1">
                                    {d}
                                  </div>
                                ))}
                              </div>
                              <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((day, i) => {
                                  if (!day.isCurrentMonth) {
                                    return (
                                      <div key={i} className="rounded-lg py-2 text-center text-[13px] text-[rgb(10_8_0/12%)]">
                                        {day.date}
                                      </div>
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
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-60"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          {tBooking("steps.time.selectTime")}
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
                                    title={!available ? tBooking("steps.time.timeUnavailable") : undefined}
                                    className={`${baseClass} ${stateClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2`}
                                    onClick={() => available && setSelectedTime(slot)}
                                  >
                                    {formatTimeFromHHMM(slot, locale as import("@/lib/i18n/config").Locale)}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[12px] text-[rgb(10_8_0/45%)] text-center py-4">
                              {tBooking("steps.time.noSlotsAvailable")}
                            </p>
                          )
                        ) : (
                          <p className="text-[12px] text-[rgb(10_8_0/35%)] text-center py-4">
                            {tBooking("steps.time.pickDateFirst")}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {step === 5 && (
                  <div className="flex flex-col h-full">
                    <div
                      className={`flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[rgb(10_8_0/15%)] [&::-webkit-scrollbar-thumb]:rounded-sm -mx-5 px-5${
                        formComplete && !isSubmitting ? "" : " pb-6"
                      }`}
                    >
                      <div className="flex flex-col gap-4 mb-[22px]">
                        <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)] flex items-center gap-1.5">
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-60"
                          >
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          {tBooking("steps.details.contactInfo")}
                        </div>
                        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor="f-first"
                              className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)]"
                            >
                              {tBooking("steps.details.firstName")}
                            </label>
                            <input
                              id="f-first"
                              type="text"
                              placeholder={tBooking("steps.details.firstNamePlaceholder")}
                              autoComplete="given-name"
                              value={firstName}
                              onChange={(event) => setFirstName(event.target.value)}
                              onBlur={() => setFirstName(firstName.trim())}
                              className="bg-white border-[1.5px] border-[rgb(10_8_0/14%)] rounded-xl px-4 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/3%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/24%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor="f-last"
                              className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)]"
                            >
                              {tBooking("steps.details.lastName")}
                            </label>
                            <input
                              id="f-last"
                              type="text"
                              placeholder={tBooking("steps.details.lastNamePlaceholder")}
                              autoComplete="family-name"
                              value={lastName}
                              onChange={(event) => setLastName(event.target.value)}
                              onBlur={() => setLastName(lastName.trim())}
                              className="bg-white border-[1.5px] border-[rgb(10_8_0/14%)] rounded-xl px-4 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/3%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/24%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 col-span-2 max-sm:col-span-1">
                            <label
                              htmlFor="f-phone"
                              className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)]"
                            >
                              {tBooking("steps.details.phone")}
                            </label>
                            <input
                              id="f-phone"
                              type="tel"
                              placeholder={tBooking("steps.details.phonePlaceholder")}
                              autoComplete="tel"
                              value={phone}
                              onChange={(event) => setPhone(event.target.value)}
                              onBlur={() => setPhone(phone.trim())}
                              className="bg-white border-[1.5px] border-[rgb(10_8_0/14%)] rounded-xl px-4 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/3%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/24%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                            />
                            <p className="text-[10px] text-[rgb(10_8_0/40%)] mt-0.5">{tBooking("steps.details.phoneFormat")}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 mb-[22px]">
                        <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)] flex items-center gap-1.5">
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-60"
                          >
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                            <line x1="1" y1="10" x2="23" y2="10" />
                          </svg>
                          {tBooking("steps.details.paymentMethod")}
                        </div>

                        <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={paymentMethod === "cash"}
                            data-testid="btn:payment-cash"
                            onClick={() => setPaymentMethod("cash")}
                            className={`text-left rounded-xl border-2 px-4 py-3 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
                              paymentMethod === "cash"
                                ? "border-gold bg-[rgb(192_154_90/6%)]"
                                : "border-[rgb(10_8_0/12%)] bg-white hover:border-[rgb(10_8_0/22%)]"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  paymentMethod === "cash" ? "border-gold" : "border-[rgb(10_8_0/25%)]"
                                }`}
                              >
                                {paymentMethod === "cash" && <div className="w-2 h-2 rounded-full bg-gold" />}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-brand-black">{tBooking("steps.details.cash")}</div>
                                <div className="text-[11px] text-[rgb(10_8_0/45%)]">{tBooking("steps.details.payAtAppointment")}</div>
                              </div>
                            </div>
                          </button>

                          {paymentConfig === null ? (
                            <div
                              className="rounded-xl border-2 border-[rgb(10_8_0/8%)] bg-[rgb(10_8_0/4%)] px-4 py-3 animate-pulse h-[62px]"
                              aria-hidden="true"
                            />
                          ) : (
                            paymentConfig.bank_transfer_enabled &&
                            paymentConfig.accounts.length > 0 && (
                              <button
                                type="button"
                                role="radio"
                                aria-checked={paymentMethod === "bank_transfer"}
                                data-testid="btn:payment-bank-transfer"
                                onClick={() => {
                                  setPaymentMethod("bank_transfer");
                                  const el = document.getElementById("payment-bank-details");
                                  if (el) el.scrollIntoView({ block: "nearest" });
                                  window.setTimeout(() => {
                                    const firstCopy = el?.querySelector('[data-copy-btn="true"]') as HTMLElement | null;
                                    if (firstCopy) firstCopy.focus();
                                  }, 50);
                                }}
                                className={`text-left rounded-xl border-2 px-4 py-3 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
                                  paymentMethod === "bank_transfer"
                                    ? "border-gold bg-[rgb(192_154_90/6%)]"
                                    : "border-[rgb(10_8_0/12%)] bg-white hover:border-[rgb(10_8_0/22%)]"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                                      paymentMethod === "bank_transfer" ? "border-gold" : "border-[rgb(10_8_0/25%)]"
                                    }`}
                                  >
                                    {paymentMethod === "bank_transfer" && <div className="w-2 h-2 rounded-full bg-gold" />}
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-brand-black">
                                      {tBooking("steps.details.bankTransfer")}
                                    </div>
                                    <div className="text-[11px] text-[rgb(10_8_0/45%)]">{tBooking("steps.details.payInAdvance")}</div>
                                  </div>
                                </div>
                              </button>
                            )
                          )}
                        </div>

                        {paymentMethod === "bank_transfer" &&
                          paymentConfig &&
                          paymentConfig.bank_transfer_enabled &&
                          paymentConfig.accounts.length > 0 && (
                            <div id="payment-bank-details" className="bg-white rounded-xl border border-[rgb(10_8_0/10%)] shadow-[0_1px_3px_rgb(0_0_0/3%)] overflow-hidden">
                              <div className="px-4 py-3 space-y-3 text-sm">
                                {paymentConfig.accounts.map((acct, idx) => (
                                  <div key={acct.id}>
                                    {idx > 0 && <div className="border-t border-[rgb(10_8_0/8%)] my-3" />}
                                    {paymentConfig.accounts.length > 1 && (
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-brand-black font-semibold">{acct.bank_name}</span>
                                        {acct.label && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgb(192_154_90/12%)] text-[rgb(192_154_90/90%)] font-medium">
                                            {acct.label}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    <div className="space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="text-[rgb(10_8_0/50%)] shrink-0">
                                          {tBooking("steps.details.accountHolder")}
                                        </span>
                                        <span className="text-brand-black font-medium text-right">{acct.account_holder}</span>
                                      </div>
                                      {paymentConfig.accounts.length === 1 && (
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="text-[rgb(10_8_0/50%)] shrink-0">{tBooking("steps.details.bank")}</span>
                                          <span className="text-brand-black font-medium text-right">{acct.bank_name}</span>
                                        </div>
                                      )}
                                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2">
                                        <span className="text-[rgb(10_8_0/50%)] shrink-0">{tBooking("steps.details.rib")}</span>
                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                          <span className="text-brand-black font-mono text-xs">{formatRib(acct.rib)}</span>
                                          <button
                                            type="button"
                                            data-copy-btn="true"
                                            onClick={() => {
                                              if (typeof navigator !== "undefined" && navigator.clipboard) {
                                                const markCopied = () => {
                                                  setCopiedField({ accountId: acct.id, field: "rib" });
                                                  setTimeout(() => setCopiedField(null), 1500);
                                                };
                                                navigator.clipboard.writeText(acct.rib).then(markCopied).catch(markCopied);
                                              } else {
                                                setCopiedField({ accountId: acct.id, field: "rib" });
                                                setTimeout(() => setCopiedField(null), 1500);
                                              }
                                            }}
                                            aria-live="polite"
                                            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.08em] text-gold hover:text-[rgb(192_154_90/70%)] transition-colors shrink-0 font-mono"
                                          >
                                            {copiedField?.accountId === acct.id && copiedField?.field === "rib"
                                              ? tBooking("steps.details.copied")
                                              : tBooking("steps.details.copy")}
                                          </button>
                                        </div>
                                      </div>
                                      {acct.iban && (
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2">
                                          <span className="text-[rgb(10_8_0/50%)] shrink-0">{tBooking("steps.details.iban")}</span>
                                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                            <span className="text-brand-black font-mono text-xs">{acct.iban}</span>
                                            <button
                                              type="button"
                                              data-copy-btn="true"
                                              onClick={() => {
                                                if (typeof navigator !== "undefined" && navigator.clipboard) {
                                                  const markCopied = () => {
                                                    setCopiedField({ accountId: acct.id, field: "iban" });
                                                    setTimeout(() => setCopiedField(null), 1500);
                                                  };
                                                  navigator.clipboard.writeText(acct.iban!).then(markCopied).catch(markCopied);
                                                } else {
                                                  setCopiedField({ accountId: acct.id, field: "iban" });
                                                  setTimeout(() => setCopiedField(null), 1500);
                                                }
                                              }}
                                              aria-live="polite"
                                              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.08em] text-gold hover:text-[rgb(192_154_90/70%)] transition-colors shrink-0 font-mono"
                                            >
                                              {copiedField?.accountId === acct.id && copiedField?.field === "iban"
                                                ? tBooking("steps.details.copied")
                                                : tBooking("steps.details.copy")}
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                <div className="border-t border-[rgb(10_8_0/8%)] my-2" />
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-[rgb(10_8_0/50%)] shrink-0">{tBooking("steps.details.reference")}</span>
                                    <span className="text-brand-black font-medium text-right">
                                      {firstName.trim()} {lastName.trim()}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[rgb(10_8_0/55%)] leading-relaxed">
                                    {tBooking("steps.details.afterTransferPrefix")}{" "}
                                    <span className="font-semibold text-brand-black">
                                      {paymentConfig.payment_phone ?? tBooking("steps.details.paymentPhoneFallback")}
                                    </span>
                                    . {tBooking("steps.details.afterTransferSuffix")}
                                  </p>
                                  {paymentConfig.instructions && (
                                    <p className="text-xs text-[rgb(10_8_0/45%)] leading-relaxed">
                                      {paymentConfig.instructions}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
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
                              {selectedDate?.fullDate ?? "—"}
                              {selectedTime ? ` · ${formatTimeFromHHMM(selectedTime, locale as import("@/lib/i18n/config").Locale)}` : ""}
                              {selectedLocation
                                ? ` · ${selectedLocation.type === "home" ? tBooking("steps.location.comeToMe") : selectedLocation.name}`
                                : ""}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[rgb(10_8_0/40%)] leading-none mb-1">
                              Total
                            </div>
                            <div className="font-playfair text-[19px] font-medium tracking-[-0.02em] text-gold leading-none">
                              {formatMoney(total, locale as import("@/lib/i18n/config").Locale)}
                            </div>
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
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                  <path
                                    fill="#fff"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                  />
                                  <path
                                    fill="#fff"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                  />
                                  <path
                                    fill="#fff"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                  />
                                </svg>
                              )}
                              {user ? tBooking("steps.details.confirmBooking") : tBooking("steps.details.continueWithGoogle")}
                            </span>
                            <span className="font-bold tracking-[-0.01em]">
                              {formatMoney(total, locale as import("@/lib/i18n/config").Locale)}
                            </span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {isSubmitting && (
                      <div className="shrink-0 px-5 pt-3 pb-5 bg-[#fafaf8] border-t border-[rgb(10_8_0/8%)]">
                        <button
                          type="button"
                          disabled
                          data-testid="btn:confirm-booking"
                          className="w-full bg-brand-black text-white text-[11px] font-semibold tracking-[0.1em] uppercase px-6 py-3.5 rounded-[10px] flex items-center justify-center gap-2 opacity-70 cursor-not-allowed"
                        >
                          <svg
                            className="w-4 h-4 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          >
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                          </svg>
                          {user ? tBooking("steps.details.saving") : tBooking("steps.details.waitingForGoogle")}
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
                      <h2 className="font-playfair text-[28px] font-medium text-brand-black mb-2 tracking-[-0.02em]">
                        {tBooking("steps.confirmation.headline")}
                      </h2>
                      <p className="text-[13px] text-[rgb(10_8_0/50%)] leading-[1.7] max-w-[320px] mx-auto mb-6">
                        {tBooking("steps.confirmation.message")}
                      </p>

                      {paymentMethod === "bank_transfer" && paymentConfig?.payment_phone && (
                        <p className="text-[12px] text-[rgb(192_154_90/80%)] leading-[1.6] max-w-[320px] mx-auto mb-4 font-medium">
                          {tBooking("steps.confirmation.dontForgetReceipt", {
                            phone: paymentConfig.payment_phone ?? tBooking("steps.details.paymentPhoneFallback"),
                          })}
                        </p>
                      )}

                      <div className="bg-white rounded-2xl border border-[rgb(10_8_0/10%)] shadow-[0_1px_3px_rgb(0_0_0/3%)] text-left px-4 py-3 mx-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-brand-black tracking-[-0.01em] truncate">
                              {firstName} {lastName}
                            </div>
                            <div className="text-[11px] text-[rgb(10_8_0/50%)] mt-0.5 truncate">
                              {selectedDate?.fullDate}
                              {selectedTime ? ` · ${formatTimeFromHHMM(selectedTime, locale as import("@/lib/i18n/config").Locale)}` : ""} ·{" "}
                              {selectedBarber?.name}
                            </div>
                            <div className="text-[11px] text-[rgb(10_8_0/45%)] mt-0.5 truncate">{selectedServicesLabel}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[rgb(10_8_0/40%)] leading-none mb-1">
                              {tBooking("steps.summary.total")}
                            </div>
                            <div className="font-playfair text-[19px] font-medium tracking-[-0.02em] text-gold leading-none">
                              {formatMoney(total, locale as import("@/lib/i18n/config").Locale)}
                            </div>
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
                          {tCommon("close")}
                        </button>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <AnimatePresence>
              {showUserPanel && (
                <UserPanel
                  onClose={() => setShowUserPanel(false)}
                  showToast={(kind, text) => setToast({ kind, text })}
                  locale={locale}
                />
              )}
            </AnimatePresence>

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
                      <h3 className="text-[15px] font-bold text-brand-black tracking-[-0.01em]">
                        {tBooking("homePanel.yourLocation")}
                      </h3>
                      <p className="text-[11px] text-[rgb(10_8_0/45%)] mt-0.5">{tBooking("homePanel.tapMapHint")}</p>
                    </div>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-full flex items-center justify-center border border-[rgb(10_8_0/20%)] cursor-pointer transition-[background,border-color] duration-200 hover:bg-[rgb(10_8_0/5%)] hover:border-[rgb(10_8_0/30%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                      onClick={() => setShowHomePanel(false)}
                      aria-label={tCommon("close")}
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
                        <svg
                          className="w-3.5 h-3.5 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path d="M3 12a9 9 0 019-9" />
                        </svg>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                        </svg>
                      )}
                      {homeLocating ? tBooking("homePanel.detecting") : tBooking("homePanel.useMyLocation")}
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
                      <svg
                        className="w-3 h-3 shrink-0 mt-px opacity-60"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>
                        {homePinGeoLoading
                          ? tBooking("homePanel.resolvingAddress")
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
                      {tBooking("homePanel.saveLocation")}
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
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
  );
}