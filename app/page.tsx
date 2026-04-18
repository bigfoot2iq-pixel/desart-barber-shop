"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReverseGeocode } from "@/hooks/use-reverse-geocode";
import { HERO_VIDEOS, DesktopVideoGrid, MobileVideoCarousel } from "@/app/components/video-grid";
import { getActiveProfessionalsWithServices, getActiveServices, getActiveSalons } from "@/lib/queries";
import type { ProfessionalWithServices } from "@/lib/queries/appointments";
import type { Salon } from "@/lib/types/database";

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
};

type ServiceOption = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
};

type DateSlot = {
  id: string;
  shortDay: string;
  displayDate: string;
  fullDate: string;
};

const REEL_DURATION_MS = 5000;
const STEP_LABELS = ["Choose a Location", "Choose a Berber", "Choose a Service", "Choose a Time", "Details"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_SLOTS = [
  "9:00",
  "9:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
];


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

function buildDateSlots(): DateSlot[] {
  const slots: DateSlot[] = [];
  const today = new Date();

  for (let i = 1; i <= 12; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    // Friday is closed.
    if (date.getDay() === 5) continue;

    const month = MONTHS[date.getMonth()];
    slots.push({
      id: date.toISOString().slice(0, 10),
      shortDay: DAYS[date.getDay()],
      displayDate: `${date.getDate()} ${month}`,
      fullDate: `${date.getDate()} ${month} ${date.getFullYear()}`,
    });
  }

  return slots;
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
  const [email, setEmail] = useState("");
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
  const [homeGeoError, setHomeGeoError] = useState<string | null>(null);

  const submitTimerRef = useRef<number | null>(null);
  const dateSlots = useMemo(() => buildDateSlots(), []);
  const availableDateIds = useMemo(() => new Set(dateSlots.map((s) => s.id)), [dateSlots]);
  const { label: homePinLabel, loading: homePinGeoLoading } = useReverseGeocode(
    homePin?.lat ?? null,
    homePin?.lng ?? null
  );

  useEffect(() => {
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
        }));
        setBarbers(mapped);
      })
      .catch((err) => {
        console.error("Failed to load professionals:", err);
      });

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
      })
      .catch((err) => {
        console.error("Failed to load services:", err);
      });

    getActiveSalons()
      .then((data: Salon[]) => {
        const mapped: LocationOption[] = data.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.address,
          imageUrl: s.image_url,
          type: "salon" as const,
        }));
        setSalons(mapped);
      })
      .catch((err) => {
        console.error("Failed to load salons:", err);
      });
  }, []);

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
      const isFriday = d.getDay() === 5;
      days.push({
        date: d.getDate(),
        dateStr,
        shortDay: dayNames[i],
        monthStr: MONTHS[d.getMonth()],
        isPast,
        isAvailable: !isPast && !isFriday && availableDateIds.has(dateStr),
        isFriday,
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
    setHomeGeoError(null);
    setHomeLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHomePin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setHomeLocating(false);
      },
      (err) => {
        setHomeGeoError(err.message);
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
      const dayOfWeek = new Date(year, month, d).getDay();
      days.push({
        date: d,
        isCurrentMonth: true,
        isAvailable: availableDateIds.has(dateStr),
        dateStr,
        isFriday: dayOfWeek === 5,
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
        setIsModalOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isModalOpen]);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current !== null) {
        window.clearTimeout(submitTimerRef.current);
      }
    };
  }, []);

  const total = selectedServices.reduce((sum, service) => sum + service.price, 0) + (selectedLocation?.type === "home" ? 30 : 0);
  const selectedServicesLabel = selectedServices.map((service) => service.name).join(", ");

  const canContinue = (() => {
    if (step === 1) return Boolean(selectedLocation);
    if (step === 2) return Boolean(selectedBarber);
    if (step === 3) return selectedServices.length > 0;
    if (step === 4) return Boolean(selectedDate && selectedTime);
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
    setEmail("");
    setIsSubmitting(false);
    setCalendarExpanded(false);
    setCalendarMonth(() => {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    });
    setShowHomePanel(false);
    setHomePin(null);
    setHomeLocating(false);
    setHomeGeoError(null);
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

  const advanceStep = () => {
    if (isSubmitting) return;

    if (step === 5) {
      if (!formComplete) return;
      setIsSubmitting(true);
      submitTimerRef.current = window.setTimeout(() => {
        setIsSubmitting(false);
        setDirection("forward");
        setStep(6);
      }, 1400);
      return;
    }

    setDirection("forward");
    setStep((current) => Math.min(current + 1, 5));
  };

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
    if (step === 3 && selectedServices.length > 0) {
      const t = window.setTimeout(() => {
        setDirection("forward");
        setStep((current) => Math.min(current + 1, 5));
      }, 500);
      return () => window.clearTimeout(t);
    }
  }, [selectedServices, step]);

  useEffect(() => {
    if (step === 4 && selectedDate && selectedTime) {
      const t = window.setTimeout(() => {
        setDirection("forward");
        setStep((current) => Math.min(current + 1, 5));
      }, 500);
      return () => window.clearTimeout(t);
    }
  }, [selectedDate, selectedTime, step]);

  useEffect(() => {
    if (step === 5 && formComplete && !isSubmitting) {
      const t = window.setTimeout(() => {
        setIsSubmitting(true);
        submitTimerRef.current = window.setTimeout(() => {
          setIsSubmitting(false);
          setDirection("forward");
          setStep(6);
        }, 1400);
      }, 600);
      return () => window.clearTimeout(t);
    }
  }, [formComplete, step, isSubmitting]);

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

  const stepTransition = {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  };

  return (
    <>
      <nav id="main-nav" className={`fixed top-0 left-0 right-0 z-[300] flex items-center justify-between px-[56px] py-5 transition-[background,padding] duration-300 ${isScrolled ? "bg-[rgb(10_8_0/90%)] [backdrop-filter:blur(18px)] py-[14px] border-b border-[rgb(254_251_243/10%)]" : ""}`}>
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

      <section className="relative w-full min-h-svh overflow-hidden bg-brand-black lg:h-svh lg:max-h-svh">
        <div className="relative w-full min-h-svh lg:flex lg:flex-row lg:h-full lg:overflow-visible lg:[clip-path:inset(-200px_0_0_0)]">
          <div className="relative z-[5] bg-brand-black w-full flex flex-col justify-center items-center pt-[30px] px-5 pb-4 lg:flex-none lg:w-[48%] lg:justify-start lg:pt-[120px] lg:pl-0 lg:pr-[56px] lg:pb-[60px] lg:h-full">
            <div className="text-center p-0 max-w-full lg:text-left">
              <h1 className="font-playfair text-[clamp(60px,16vw,104px)] lg:text-[clamp(68px,7vw,148px)] font-normal leading-[0.85] tracking-[-0.02em] text-brand-white [animation:fade-up_0.9s_ease-out_0.3s_both]">
                Sharp <span className="italic text-gold4 tracking-[-0.04em] font-medium">cuts.</span>
                <br />
                <span className="[-webkit-text-stroke:2px_var(--color-gold3)] text-transparent">Sharper</span> style.
              </h1>
              <p className="text-[13px] lg:text-[15px] font-light text-[rgb(254_251_243/48%)] lg:text-[rgb(254_251_243/55%)] max-w-[340px] lg:max-w-[460px] mx-auto mt-5 lg:mt-8 lg:mb-10 lg:mx-0 leading-[1.65] tracking-[0.02em] [animation:fade-up_0.9s_ease-out_0.5s_both]">
                Premium grooming for those who know the difference.
              </p>
              <div className="w-14 h-px bg-gold3 my-5 mx-auto lg:mx-0 [animation:fade-up_0.9s_ease-out_0.6s_both]" />
              <div className="flex items-center gap-2 text-[10px] font-normal tracking-[0.14em] uppercase text-[rgb(254_251_243/38%)] justify-center lg:justify-start [animation:fade-up_0.9s_ease-out_0.7s_both]">
                <span>AGADIR</span>
                <span className="text-gold3 opacity-60 text-[8px]">·</span>
                <span>Always Available</span>
                <span className="text-gold3 opacity-60 text-[8px]">·</span>
                <span>By Appointment</span>
              </div>

              {/* CTA pair */}
              <div className="mt-8 lg:mt-10 hidden sm:flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 justify-center lg:justify-start [animation:fade-up_0.9s_ease-out_0.9s_both]">
                <button
                  type="button"
                  onClick={openModal}
                  className="open-booking group relative inline-flex items-center justify-center gap-2 bg-gold3 text-brand-black text-[12px] font-semibold tracking-[0.2em] uppercase px-7 py-4 rounded-full transition-[transform,box-shadow,background-color] duration-200 hover:bg-gold4 hover:-translate-y-px shadow-[0_10px_30px_-10px_rgb(212_175_112/0.6)] cursor-pointer"
                >
                  Reserve Your Chair
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <a
                  href="#services"
                  className="inline-flex items-center justify-center gap-2 text-[12px] font-medium tracking-[0.2em] uppercase text-brand-white/85 hover:text-brand-white px-5 py-4 border border-[rgb(254_251_243/14%)] hover:border-gold3/60 rounded-full transition-colors"
                >
                  View Services
                </a>
              </div>
            </div>

            <div className="w-full mt-[60px] lg:hidden [animation:fade-up_1s_ease-out_1.5s_both]">
              <MobileVideoCarousel />

            </div>
          </div>

          <div className="hidden lg:block lg:flex-1 lg:relative lg:overflow-visible lg:z-[1] lg:-mt-[120px]">
            <DesktopVideoGrid />
            <div className="absolute left-0 right-0 h-[100px] z-[3] pointer-events-none top-0 bg-gradient-to-b from-brand-black to-transparent" />
            <div className="absolute left-0 right-0 h-[100px] z-[3] pointer-events-none bottom-[110px] bg-gradient-to-t from-brand-black to-transparent" />
          </div>
        </div>
      </section>

      <section id="services" className="bg-gold-bg text-brand-black">
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

      <div className="mq-wrap">
        <div className="mq-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, index) => (
            <div className="mq-item" key={`${item}-${index}`}>
              {item} <span className="mq-dot" />
            </div>
          ))}
        </div>
      </div>

      <section id="team" className="bg-brand-black text-brand-white">
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

      <section id="locations" className="bg-gold-bg text-brand-black">
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
            className="float-book open-booking"
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
                closeModal();
              }
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="w-[375px] h-[727px] bg-[#fafaf8] rounded-l-[20px] flex flex-col overflow-hidden shadow-[-12px_0_60px_rgb(0_0_0/12%),-4px_0_20px_rgb(0_0_0/6%)] pointer-events-auto font-dm-sans max-sm:w-full max-sm:h-full max-sm:rounded-none max-sm:shadow-none [&_*]:font-[inherit] [&_.font-playfair]:font-playfair"
              role="dialog"
              aria-modal="true"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="relative flex items-center gap-1.5 px-5 pt-[18px] pb-4 bg-white border-b border-[rgb(10_8_0/6%)] shrink-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[rgb(10_8_0/4%)] after:to-transparent">
                <AnimatePresence>
                  {step > 1 && step < 6 && (
                    <motion.button
                      key="back-arrow"
                      type="button"
                      initial={false}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } }}
                      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                      className="w-8 h-8 flex items-center justify-center bg-none border-none cursor-pointer text-brand-black rounded-lg transition-[background,color] duration-200 shrink-0 p-0 hover:bg-[rgb(10_8_0/6%)] active:bg-[rgb(10_8_0/10%)]"
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
                  <p
                    key={`header-${step}`}
                    className="text-[15px] font-bold text-brand-black m-0 text-left tracking-[-0.01em]"
                    id="panel-title"
                  >
                    {step === 1 && "Choose a Location"}
                    {step === 2 && "Choose a Berber"}
                    {step === 3 && "Choose a Service"}
                    {step === 4 && "Choose a Time"}
                    {step === 5 && "Your Details"}
                    {step === 6 && "Booking Confirmed"}
                  </p>
                </div>
                <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center bg-none border border-[rgb(10_8_0/12%)] cursor-pointer text-brand-black transition-[background,border-color] duration-200 shrink-0 p-0 hover:bg-[rgb(10_8_0/5%)] hover:border-[rgb(10_8_0/20%)]" onClick={closeModal} aria-label="Close">
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
                    className="absolute inset-0 overflow-y-auto p-5 [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent]"
                    data-scrollbar
                  >
                    {step === 1 && (
                      <>
                        <div className="flex mb-4">
                          <button type="button" className="flex items-center justify-center h-8 px-[19px] mr-3 rounded-full border border-[rgb(10_8_0/15%)] bg-white uppercase text-[11px] font-semibold tracking-[0.05em] text-black transition-all duration-200 hover:border-[rgb(10_8_0/30%)] hover:bg-[rgb(10_8_0/3%)]">
                            Nearby
                            <svg width="10" height="12" viewBox="0 0 10 12" fill="none" className="ml-1.5 opacity-60">
                              <path d="M5 0C2.79 0 1 1.79 1 4c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" fill="currentColor"/>
                              <circle cx="5" cy="4" r="1.5" fill="white"/>
                            </svg>
                          </button>
                          <button type="button" className="flex items-center justify-center h-8 px-[19px] mr-3 rounded-full border border-[rgb(10_8_0/15%)] bg-white uppercase text-[11px] font-semibold tracking-[0.05em] text-black transition-all duration-200 hover:border-[rgb(10_8_0/30%)] hover:bg-[rgb(10_8_0/3%)]" onClick={openHomePanel}>
                            Come to me
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1.5 opacity-60">
                              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                              <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                          {salons.map((location) => {
                            const isLocationSelected = selectedLocation?.id === location.id;
                            return (
                              <button
                                key={location.id}
                                type="button"
                                className={`flex items-start gap-3.5 rounded-2xl px-[18px] py-3.5 text-left transition-all duration-200 relative ${isLocationSelected ? "border-[1.5px] border-gold bg-gold" : "border-[1.5px] border-[rgb(10_8_0/7%)] bg-white shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/15%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"}`}
                                onClick={() => setSelectedLocation(location)}
                              >
                                {location.imageUrl ? (
                                  <img src={location.imageUrl} alt={location.name} className={`shrink-0 w-[107px] h-[107px] rounded-[10px] object-cover transition-[border-color] duration-200 ${isLocationSelected ? "border-2 border-[rgb(255_255_255/30%)]" : "border-2 border-[rgb(192_154_90/20%)]"}`} />
                                ) : (
                                  <div className={`relative flex items-center justify-center shrink-0 w-[38px] h-[38px] rounded-[10px] ${isLocationSelected ? "bg-[rgb(255_255_255/25%)]" : "bg-[rgb(10_8_0/4%)]"}`}>
                                    <svg className={`w-5 h-5 transition-[opacity,color] duration-200 ${isLocationSelected ? "opacity-100 text-white" : "opacity-70 text-brand-black"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                      <polyline points="9 22 9 12 15 12 15 22" />
                                    </svg>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className={`text-[17px] font-semibold leading-snug tracking-[-0.408px] mb-0.5 ${isLocationSelected ? "text-white" : "text-brand-black"}`}>{location.name}</div>
                                  <div className={`text-[13px] leading-[18px] tracking-[-0.078px] font-normal ${isLocationSelected ? "text-[rgb(255_255_255/70%)]" : "text-[rgb(10_8_0/55%)]"}`}>{location.description}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <p className="text-[13px] text-[rgb(10_8_0/55%)] mb-[18px] leading-relaxed font-normal">Choose your barber — each one brings a unique style.</p>
                        <div className="flex flex-col gap-2">
                          {barbers.map((barber) => {
                            const isBarberSelected = selectedBarber?.id === barber.id;
                            return (
                              <button
                                key={barber.id}
                                type="button"
                                className={`flex items-center gap-3.5 rounded-2xl px-[18px] py-4 text-left transition-all duration-250 relative ${isBarberSelected ? "border-[1.5px] border-gold bg-gold shadow-[0_4px_16px_rgb(192_154_90/15%),0_2px_6px_rgb(0_0_0/4%)]" : "bg-white border-[1.5px] border-[rgb(10_8_0/7%)] shadow-[0_1px_3px_rgb(0_0_0/4%)] hover:border-[rgb(10_8_0/15%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"}`}
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
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {step === 3 && (
                      <>
                        <p className="text-[13px] text-[rgb(10_8_0/55%)] mb-[18px] leading-relaxed font-normal">Select one or more services — cash payment at time of service.</p>
                        <div className="flex flex-col gap-2">
                          {services.map((service) => {
                            const isServiceSelected = selectedServices.some((s) => s.id === service.id);
                            return (
                              <button
                                key={service.id}
                                type="button"
                                className={`flex items-center justify-between rounded-xl px-4 py-3.5 transition-all duration-250 ${isServiceSelected ? "border-[1.5px] border-gold bg-gold shadow-[0_2px_8px_rgb(192_154_90/10%)]" : "border-[1.5px] border-[rgb(10_8_0/7%)] bg-white shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/15%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"}`}
                                onClick={() => toggleService(service)}
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
                      </>
                    )}

                    {step === 4 && (
                      <>
                        <p className="text-[13px] text-[rgb(10_8_0/55%)] mb-[18px] leading-relaxed font-normal">Pick a date and time that works for you.</p>
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
                                          ? "border-[1.5px] border-[rgb(10_8_0/4%)] bg-[rgb(10_8_0/2%)] cursor-not-allowed"
                                          : day.isAvailable
                                          ? "border-[1.5px] border-[rgb(10_8_0/7%)] bg-white shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/15%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)] cursor-pointer"
                                          : "border-[1.5px] border-[rgb(10_8_0/4%)] bg-[rgb(10_8_0/2%)] cursor-not-allowed"
                                      }`}
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
                                  className="flex-1 flex flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-[rgb(10_8_0/10%)] bg-white transition-all duration-250 hover:border-[rgb(10_8_0/18%)] hover:bg-[rgb(10_8_0/2%)] cursor-pointer"
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
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-200 ${canGoPrevMonth ? "border-[rgb(10_8_0/8%)] text-brand-black hover:border-[rgb(10_8_0/20%)] hover:bg-[rgb(10_8_0/4%)] cursor-pointer" : "border-[rgb(10_8_0/5%)] text-[rgb(10_8_0/20%)] cursor-not-allowed"}`}
                                      >
                                        <svg viewBox="0 0 10 16" width="8" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 1L1 8l8 7" /></svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={goNextMonth}
                                        disabled={!canGoNextMonth}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-200 ${canGoNextMonth ? "border-[rgb(10_8_0/8%)] text-brand-black hover:border-[rgb(10_8_0/20%)] hover:bg-[rgb(10_8_0/4%)] cursor-pointer" : "border-[rgb(10_8_0/5%)] text-[rgb(10_8_0/20%)] cursor-not-allowed"}`}
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
                                              ? "border-[1.5px] border-[rgb(10_8_0/7%)] bg-white text-brand-black shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/15%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"
                                              : day.isFriday
                                              ? "border-[1.5px] border-[rgb(10_8_0/4%)] bg-[rgb(10_8_0/2%)] text-[rgb(10_8_0/20%)] line-through cursor-not-allowed"
                                              : "text-[rgb(10_8_0/25%)] cursor-not-allowed"
                                          }`}
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
                          <div className="flex flex-col pt-5 border-t border-[rgb(10_8_0/6%)]">
                            <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)] mb-3 flex items-center gap-1.5">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                              </svg>
                              Select Time
                            </div>
                            <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-3">
                              {TIME_SLOTS.map((slot) => {
                                const isTimeSelected = selectedTime === slot;
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    className={`rounded-[10px] px-1.5 py-2.5 text-center text-[13px] font-semibold tracking-[-0.01em] transition-all duration-250 ${isTimeSelected ? "border-[1.5px] border-gold bg-gold text-white shadow-[0_4px_12px_rgb(192_154_90/25%)]" : "border-[1.5px] border-[rgb(10_8_0/7%)] bg-white text-brand-black shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/15%)] hover:bg-[rgb(10_8_0/3%)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"}`}
                                    onClick={() => setSelectedTime(slot)}
                                  >
                                    {slot}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {step === 5 && (
                      <>
                        <p className="text-[13px] text-[rgb(10_8_0/55%)] mb-[18px] leading-relaxed font-normal">Almost there — just a few details to wrap up your booking.</p>

                        <div className="flex flex-col gap-4 mb-[22px]">
                          <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)] flex items-center gap-1.5">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Booking Summary
                          </div>
                          <div className="bg-white rounded-2xl border-[1.5px] border-[rgb(10_8_0/7%)] px-[18px] py-4 flex flex-col gap-0 shadow-[0_1px_2px_rgb(0_0_0/3%)]">
                            <div className="flex justify-between items-center gap-3 py-2">
                              <span className="text-[rgb(10_8_0/40%)] flex items-center gap-[5px] text-[11px] font-medium">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[rgb(10_8_0/40%)] shrink-0">
                                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                Location
                              </span>
                              <span className="text-sm font-semibold tracking-[-0.01em]">{selectedLocation ? `${selectedLocation.name}${selectedLocation.type === "salon" ? ` · ${selectedLocation.description}` : ""}` : "—"}</span>
                            </div>
                            <div className="flex justify-between items-center gap-3 py-2 border-t border-[rgb(10_8_0/6%)]">
                              <span className="text-[rgb(10_8_0/40%)] flex items-center gap-[5px] text-[11px] font-medium">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[rgb(10_8_0/40%)] shrink-0">
                                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                                Barber
                              </span>
                              <span className="text-sm font-semibold tracking-[-0.01em]">{selectedBarber?.name ?? "—"}</span>
                            </div>
                            <div className="flex justify-between items-center gap-3 py-2 border-t border-[rgb(10_8_0/6%)]">
                              <span className="text-[rgb(10_8_0/40%)] flex items-center gap-[5px] text-[11px] font-medium">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[rgb(10_8_0/40%)] shrink-0">
                                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                Services
                              </span>
                              <span className="text-sm font-semibold tracking-[-0.01em] text-right">{selectedServicesLabel || "—"}</span>
                            </div>
                            <div className="flex justify-between items-center gap-3 py-2 border-t border-[rgb(10_8_0/6%)]">
                              <span className="text-[rgb(10_8_0/40%)] flex items-center gap-[5px] text-[11px] font-medium">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[rgb(10_8_0/40%)] shrink-0">
                                  <rect x="3" y="4" width="18" height="18" rx="2" />
                                  <path d="M16 2v4M8 2v4M3 10h18" />
                                </svg>
                                Date & Time
                              </span>
                              <span className="text-sm font-semibold tracking-[-0.01em]">
                                {selectedDate?.fullDate ?? "—"}{selectedTime ? ` · ${selectedTime}` : ""}
                              </span>
                            </div>
                            <div className="flex justify-between items-center gap-3 pt-3 mt-1 border-t-2 border-[rgb(10_8_0/10%)]">
                              <span className="text-[rgb(10_8_0/40%)] text-[11px] font-semibold tracking-[0.02em] uppercase">Total</span>
                              <span className="text-[17px] font-bold tracking-[-0.02em] text-gold">{total} MAD</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-4">
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
                                className="bg-white border-[1.5px] border-[rgb(10_8_0/7%)] rounded-xl px-4 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/3%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/15%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
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
                                className="bg-white border-[1.5px] border-[rgb(10_8_0/7%)] rounded-xl px-4 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/3%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/15%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
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
                                className="bg-white border-[1.5px] border-[rgb(10_8_0/7%)] rounded-xl px-4 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/3%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/15%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5 col-span-2 max-sm:col-span-1">
                              <label htmlFor="f-email" className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[rgb(10_8_0/40%)]">
                                Email <span className="text-[rgb(10_8_0/28%)] font-normal normal-case tracking-normal">(optional)</span>
                              </label>
                              <input
                                id="f-email"
                                type="email"
                                placeholder="your@email.com"
                                autoComplete="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className="bg-white border-[1.5px] border-[rgb(10_8_0/7%)] rounded-xl px-4 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/3%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/15%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-[rgb(10_8_0/45%)] leading-relaxed mt-5 flex items-start gap-2 px-4 py-3 bg-[rgb(192_154_90/5%)] rounded-xl border border-[rgb(192_154_90/10%)]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 shrink-0 mt-px opacity-40 text-gold">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4M12 8h.01" />
                          </svg>
                          Cash only, due at time of service. Free cancellations — just let us know.
                        </div>
                      </>
                    )}

                    {step === 6 && (
                      <div className="text-center pt-5 pb-2">
                        <div className="w-[72px] h-[72px] rounded-full bg-[linear-gradient(135deg,#c09a5a,#d4ae70)] flex items-center justify-center mx-auto mb-6 animate-pop-in shadow-[0_8px_24px_rgb(192_154_90/30%),0_4px_10px_rgb(0_0_0/8%)]">
                          <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
                            <svg className="w-6 h-6 stroke-gold fill-none stroke-[2.5] animate-check-draw" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        </div>
                        <h2 className="font-playfair text-[28px] font-medium text-brand-black mb-2 tracking-[-0.02em]">You&apos;re all set!</h2>
                        <p className="text-[13px] text-[rgb(10_8_0/50%)] leading-[1.7] max-w-[320px] mx-auto mb-6">Your appointment has been received. We&apos;ll reach out to confirm within a few hours.</p>
                        <div className="bg-white rounded-2xl border border-[rgb(10_8_0/6%)] px-[18px] py-4 text-left flex flex-col gap-0 shadow-[0_1px_3px_rgb(0_0_0/4%)] mb-6">
                          <div className="flex justify-between items-center text-[13px] text-brand-black gap-3 py-2 border-t border-[rgb(10_8_0/4%)]">
                            <span className="opacity-50 text-xs font-medium">Name</span>
                            <span>{firstName} {lastName}</span>
                          </div>
                          <div className="flex justify-between items-center text-[13px] text-brand-black gap-3 py-2 border-t border-[rgb(10_8_0/4%)]">
                            <span className="opacity-50 text-xs font-medium">Date & Time</span>
                            <span>{selectedDate?.fullDate} · {selectedTime}</span>
                          </div>
                          <div className="flex justify-between items-center text-[13px] text-brand-black gap-3 py-2 border-t border-[rgb(10_8_0/4%)]">
                            <span className="opacity-50 text-xs font-medium">Barber</span>
                            <span>{selectedBarber?.name}</span>
                          </div>
                          <div className="flex justify-between items-center text-[13px] text-brand-black gap-3 py-2 border-t border-[rgb(10_8_0/4%)]">
                            <span className="opacity-50 text-xs font-medium">Services</span>
                            <span>{selectedServicesLabel}</span>
                          </div>
                          <div className="flex justify-between items-center text-[13px] text-brand-black gap-3 pt-3 mt-1 border-t border-[rgb(10_8_0/8%)]">
                            <span className="opacity-50 text-xs font-medium">Total</span>
                            <span className="text-[17px] font-bold text-gold tracking-[-0.02em]">{total} MAD</span>
                          </div>
                        </div>
                        <button type="button" className="w-full bg-brand-black text-gold3 text-[11px] font-semibold tracking-[0.1em] uppercase px-6 py-3.5 rounded-[10px] flex items-center justify-center gap-1.5 transition-[background,transform,box-shadow] duration-200 shadow-[0_2px_8px_rgb(0_0_0/12%)] cursor-pointer border-none hover:bg-ink hover:-translate-y-px hover:shadow-[0_6px_20px_rgb(0_0_0/18%)] active:translate-y-0" onClick={finishBooking}>
                          Close
                        </button>
                      </div>
                    )}
                  </motion.div>
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
                      transition={{ type: "spring", damping: 28, stiffness: 250 }}
                    >
                      <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0 border-b border-[rgb(10_8_0/6%)]">
                        <div>
                          <h3 className="text-[15px] font-bold text-brand-black tracking-[-0.01em]">Your Location</h3>
                          <p className="text-[11px] text-[rgb(10_8_0/45%)] mt-0.5">Tap the map or drag the pin to your address</p>
                        </div>
                        <button
                          type="button"
                          className="w-8 h-8 rounded-full flex items-center justify-center border border-[rgb(10_8_0/12%)] cursor-pointer transition-[background,border-color] duration-200 hover:bg-[rgb(10_8_0/5%)] hover:border-[rgb(10_8_0/20%)]"
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
                          className="self-start flex items-center gap-2 h-8 px-4 rounded-full border border-[rgb(10_8_0/15%)] bg-white text-[11px] font-semibold tracking-[0.05em] uppercase text-brand-black transition-all duration-200 hover:border-[rgb(10_8_0/30%)] hover:bg-[rgb(10_8_0/3%)] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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

                        {homeGeoError && (
                          <div className="text-[11px] text-red-500 px-3 py-2 bg-red-50 rounded-lg">{homeGeoError}</div>
                        )}

                        <div className="rounded-xl overflow-hidden border border-[rgb(10_8_0/8%)]" style={{ height: 230 }}>
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

                      <div className="px-5 pb-5 pt-3 shrink-0 border-t border-[rgb(10_8_0/6%)]">
                        <button
                          type="button"
                          className="w-full bg-brand-black text-gold3 text-[11px] font-semibold tracking-[0.1em] uppercase px-6 py-3.5 rounded-[10px] flex items-center justify-center gap-1.5 transition-[background,transform,box-shadow] duration-200 shadow-[0_2px_8px_rgb(0_0_0/12%)] cursor-pointer border-none hover:bg-ink hover:-translate-y-px hover:shadow-[0_6px_20px_rgb(0_0_0/18%)]"
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
