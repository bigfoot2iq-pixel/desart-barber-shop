"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

type LocationOption = {
  id: "salon" | "home";
  name: string;
  description: string;
};

type BarberOption = {
  id: "amine" | "youssef" | "karim";
  shortName: string;
  name: string;
  role: string;
};

type ServiceOption = {
  id: "haircut" | "skinfade" | "beard" | "shave";
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
const STEP_LABELS = ["Location", "Barber", "Services", "Time", "Details"];
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
const HERO_VIDEOS = ["/videos/hero-1.mp4", "/videos/hero-2.mp4", "/videos/hero-3.mp4", "/videos/hero-4.mp4", "/videos/hero-1.mp4", "/videos/hero-2.mp4", "/videos/hero-3.mp4", "/videos/hero-4.mp4"];

const VIDEO_META: { src: string; title: string; style: string; likes: string; views: string }[] = [
  { src: HERO_VIDEOS[0], title: "The Classic Cut — Where Tradition Meets Modern Elegance", style: "Timeless Precision", likes: "2.4K", views: "12.8K" },
  { src: HERO_VIDEOS[1], title: "Skin Fade Mastery — Clean Lines, Bold Statements", style: "Sharp & Refined", likes: "3.1K", views: "18.2K" },
  { src: HERO_VIDEOS[2], title: "Beard Sculpting — Artistry in Every Detail", style: "Precision Crafted", likes: "1.9K", views: "9.5K" },
  { src: HERO_VIDEOS[3], title: "Hot Towel Ritual — The Ultimate Grooming Experience", style: "Pure Luxury", likes: "2.7K", views: "15.3K" },
  { src: HERO_VIDEOS[4], title: "Textured Flow — Effortless Style, Expert Execution", style: "Modern Edge", likes: "2.1K", views: "11.4K" },
  { src: HERO_VIDEOS[5], title: "Straight Razor Finish — Old School, New Standard", style: "Heritage Craft", likes: "1.6K", views: "8.7K" },
  { src: HERO_VIDEOS[6], title: "The Full Transformation — From Rough to Refined", style: "Complete Makeover", likes: "3.8K", views: "22.1K" },
  { src: HERO_VIDEOS[7], title: "Signature Styling — Your Look, Elevated", style: "Bespoke Grooming", likes: "2.9K", views: "16.5K" },
];

function getVideoMeta(src: string) {
  return VIDEO_META.find((m) => m.src === src) || { title: "", style: "", likes: "", views: "" };
}

function VideoCell({ src, index, featured = false }: { src: string; index: number; featured?: boolean }) {
  const meta = getVideoMeta(src);

  return (
    <div
      className={`group relative overflow-hidden rounded-md bg-brand-black shrink-0 h-[700px] border transition-[border-color,transform,box-shadow] duration-350 ease-out ${featured ? "border-gold3 shadow-[0_0_16px_rgb(212_175_55/0.15)]" : "border-transparent"} hover:border-gold3 hover:shadow-[0_0_20px_rgb(212_175_55/0.2)] focus-visible:outline-2 focus-visible:outline-gold3 focus-visible:outline-offset-2`}
      role="img"
      aria-label={`${meta.title} - ${meta.style} style`}
      tabIndex={0}
    >
      <video autoPlay muted loop playsInline preload="metadata" aria-hidden="true" className="w-full h-full object-cover block [filter:brightness(0.65)_contrast(1.1)_saturate(1.1)] transition-[filter,transform] duration-500 ease-out group-hover:[filter:brightness(0.75)_contrast(1.05)_saturate(1.15)] group-hover:scale-105">
        <source src={src} type="video/mp4" />
      </video>
      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[rgb(0_0_0/0.75)] border border-[rgb(212_175_55/0.5)] text-[#fefbe3] text-[10px] font-semibold tracking-[0.1em] uppercase [backdrop-filter:blur(8px)] z-[2] pointer-events-none shadow-[0_2px_8px_rgb(0_0_0/0.4)] before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-gold3 before:shrink-0">{meta.style}</span>
      <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-b from-[rgb(10_8_0/0)] from-40% to-[rgb(10_8_0/0.85)] opacity-0 transition-opacity duration-350 ease-out pointer-events-none group-hover:opacity-100">
        <div className="flex justify-start items-end">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-[rgb(254_251_243/0.95)] tracking-[0.02em]">{meta.title}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileVideoCarousel() {
  const [activeIndex, setActiveIndex] = useState(3);
  const touchStartX = useRef<number | null>(null);
  const videos = HERO_VIDEOS.slice(0, 6);
  const count = videos.length;

  const leftVideo = videos[(activeIndex - 1 + count) % count];
  const centerVideo = videos[activeIndex];
  const rightVideo = videos[(activeIndex + 1) % count];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      setActiveIndex((prev) => (prev + (delta < 0 ? 1 : -1) + count) % count);
    }
    touchStartX.current = null;
  };

  return (
    <>
      <div className="absolute w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {videos.map((src) => (
          <video key={src} preload="auto" src={src} muted />
        ))}
      </div>
      <div
        className="flex items-center justify-center gap-1.5 w-full [touch-action:pan-y] px-2"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative shrink-0 rounded-[14px] overflow-hidden bg-[#151515] w-[30%] aspect-[9/13]">
          <video autoPlay muted loop playsInline className="relative z-0 w-full h-full object-cover block [filter:brightness(0.4)_contrast(0.9)_saturate(0.7)]" src={leftVideo} />
        </div>
        <div className="relative shrink-0 rounded-[14px] overflow-hidden bg-[#151515] w-[60%] aspect-[9/14]">
          <video autoPlay muted loop playsInline className="relative z-0 w-full h-full object-cover block" src={centerVideo} />
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-[rgb(0_0_0/0.7)] border border-[rgb(212_175_55/0.4)] text-[#fefbe3] text-[8px] font-semibold tracking-[0.1em] uppercase [backdrop-filter:blur(6px)] z-[2] pointer-events-none shadow-[0_2px_8px_rgb(0_0_0/0.4)] before:content-[''] before:w-[5px] before:h-[5px] before:rounded-full before:bg-gold3 before:shrink-0">{getVideoMeta(centerVideo).style}</span>
        </div>
        <div className="relative shrink-0 rounded-[14px] overflow-hidden bg-[#151515] w-[30%] aspect-[9/13]">
          <video autoPlay muted loop playsInline className="relative z-0 w-full h-full object-cover block [filter:brightness(0.4)_contrast(0.9)_saturate(0.7)]" src={rightVideo} />
        </div>
      </div>
    </>
  );
}

const LOCATIONS: LocationOption[] = [
  {
    id: "salon",
    name: "Visit Salon",
    description: "Visit Salon (14 Rue Mohammed V)",
  },
  {
    id: "home",
    name: "Come To Me",
    description: "Home Visit (+30 MAD)",
  },
];

const BARBERS: BarberOption[] = [
  {
    id: "amine",
    shortName: "AK",
    name: "Amine Karimi",
    role: "Master Barber",
  },
  {
    id: "youssef",
    shortName: "YB",
    name: "Youssef Benali",
    role: "Senior Barber",
  },
  {
    id: "karim",
    shortName: "KM",
    name: "Karim Mansouri",
    role: "Senior Barber",
  },
];

const SERVICES: ServiceOption[] = [
  {
    id: "haircut",
    name: "Classic Cut",
    description: "Scissors or clippers, shaped to you.",
    price: 60,
    duration: 45,
  },
  {
    id: "skinfade",
    name: "Skin Fade",
    description: "Clean gradient, razor-sharp lines.",
    price: 100,
    duration: 60,
  },
  {
    id: "beard",
    name: "Beard Trim",
    description: "Lines, edges, and shape.",
    price: 50,
    duration: 30,
  },
  {
    id: "shave",
    name: "Hot Towel Shave",
    description: "Hot towel, straight razor.",
    price: 80,
    duration: 45,
  },
];

const MARQUEE_ITEMS = [
  "Precision Fades",
  "Classic Cuts",
  "Beard Sculpting",
  "Hot Towel Shaves",
  "Cash Only · No Fuss",
  "Same Day Booking",
  "Marrakech Finest",
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

  const submitTimerRef = useRef<number | null>(null);
  const dateSlots = useMemo(() => buildDateSlots(), []);

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

  const total = selectedServices.reduce((sum, service) => sum + service.price, 0) + (selectedLocation?.id === "home" ? 30 : 0);
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
  const closeModal = () => setIsModalOpen(false);

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
    if (targetStep < 2) setSelectedBarber(null);
    if (targetStep < 3) setSelectedServices([]);
    if (targetStep < 4) {
      setSelectedDate(null);
      setSelectedTime(null);
    }
    setStep(targetStep);
  };

  // Auto-advance on single-choice steps
  useEffect(() => {
    if (direction === "back") return;
    if (step === 1 && selectedLocation) {
      const t = window.setTimeout(() => {
        setDirection("forward");
        setStep((current) => Math.min(current + 1, 5));
      }, 350);
      return () => window.clearTimeout(t);
    }
  }, [selectedLocation, step, direction]);

  useEffect(() => {
    if (direction === "back") return;
    if (step === 2 && selectedBarber) {
      const t = window.setTimeout(() => {
        setDirection("forward");
        setStep((current) => Math.min(current + 1, 5));
      }, 350);
      return () => window.clearTimeout(t);
    }
  }, [selectedBarber, step, direction]);

  useEffect(() => {
    if (direction === "back") return;
    if (step === 3 && selectedServices.length > 0) {
      const t = window.setTimeout(() => {
        setDirection("forward");
        setStep((current) => Math.min(current + 1, 5));
      }, 350);
      return () => window.clearTimeout(t);
    }
  }, [selectedServices, step, direction]);

  useEffect(() => {
    if (direction === "back") return;
    if (step === 4 && selectedDate && selectedTime) {
      const t = window.setTimeout(() => {
        setDirection("forward");
        setStep((current) => Math.min(current + 1, 5));
      }, 350);
      return () => window.clearTimeout(t);
    }
  }, [selectedDate, selectedTime, step, direction]);

  useEffect(() => {
    if (direction === "back") return;
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
  }, [formComplete, step, isSubmitting, direction]);

  const stepPanelClassName = (panelStep: number) => {
    const isActive = step === panelStep;
    const isBack = isActive && direction === "back";
    return `absolute inset-0 overflow-y-auto p-5 ${isActive ? "relative opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"} ${isActive ? (isBack ? "animate-slide-back" : "animate-slide-in") : ""} [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent]`;
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
          <div className="relative z-[5] bg-brand-black w-full flex flex-col justify-center items-center pt-[65px] px-5 pb-4 lg:flex-none lg:w-[48%] lg:justify-start lg:pt-[120px] lg:pl-0 lg:pr-[56px] lg:pb-[60px] lg:h-full">
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
            </div>
            
            <div className="w-full mt-[60px] lg:hidden [animation:fade-up_1s_ease-out_1.5s_both]">
              <MobileVideoCarousel />
            </div>
          </div>

          <div className="hidden lg:block lg:flex-1 lg:relative lg:overflow-visible lg:z-[1] lg:-mt-[120px]">
            <div className="grid grid-cols-3 gap-1 h-full">
              <div className="group overflow-hidden relative h-full">
                <div className="flex flex-col gap-1 will-change-transform animate-vg-scroll-down group-hover:[animation-play-state:paused]">
                  {[HERO_VIDEOS[0], HERO_VIDEOS[1], HERO_VIDEOS[2], HERO_VIDEOS[3], HERO_VIDEOS[0], HERO_VIDEOS[1], HERO_VIDEOS[2], HERO_VIDEOS[3]].map((src, i) => (
                    <VideoCell key={`c1-${i}`} src={src} index={i} />
                  ))}
                </div>
              </div>
              <div className="group overflow-hidden relative h-full">
                <div className="flex flex-col gap-1 will-change-transform animate-vg-scroll-up group-hover:[animation-play-state:paused]">
                  {[HERO_VIDEOS[1], HERO_VIDEOS[3], HERO_VIDEOS[0], HERO_VIDEOS[2], HERO_VIDEOS[1], HERO_VIDEOS[3], HERO_VIDEOS[0], HERO_VIDEOS[2]].map((src, i) => (
                    <VideoCell key={`c2-${i}`} src={src} index={i} featured={i === 0} />
                  ))}
                </div>
              </div>
              <div className="group overflow-hidden relative h-full">
                <div className="flex flex-col gap-1 will-change-transform animate-vg-scroll-down group-hover:[animation-play-state:paused]">
                  {[HERO_VIDEOS[2], HERO_VIDEOS[0], HERO_VIDEOS[3], HERO_VIDEOS[1], HERO_VIDEOS[2], HERO_VIDEOS[0], HERO_VIDEOS[3], HERO_VIDEOS[1]].map((src, i) => (
                    <VideoCell key={`c3-${i}`} src={src} index={i} />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute left-0 right-0 h-[100px] z-[3] pointer-events-none top-0 bg-gradient-to-b from-brand-black to-transparent" />
            <div className="absolute left-0 right-0 h-[100px] z-[3] pointer-events-none bottom-[110px] bg-gradient-to-t from-brand-black to-transparent" />
          </div>
        </div>
      </section>

      <section id="services" className="bg-gold-bg text-brand-black">
        <div className="max-w-[1160px] mx-auto">
          <div className="flex flex-col items-start gap-3 mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-5 sm:mb-14">
            <div>
              <div className="sl">What We Do</div>
              <h2 className="sh2">Services</h2>
            </div>
            <p className="slead">Cash only. Same-day booking available.</p>
          </div>

          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-[2px]">
            {SERVICES.map((service) => (
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
            {SERVICES.map((service) => {
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
              <div className="sl text-[rgb(254_251_243/50%)]">The Craftsmen</div>
              <h2 className="sh2 text-brand-white">
                Meet Our <em className="text-gold3">Team</em>
              </h2>
              <p className="slead text-[rgb(254_251_243/50%)]">Every one of our barbers brings a distinct edge. Pick your style, pick your pro.</p>
            </div>
          </div>

          {/* Mobile: Accordion */}
          <div className="flex flex-col sm:hidden border-t border-[rgb(254_251_243/10%)]">
            {BARBERS.map((barber) => {
              const isOpen = expandedTeamMember === barber.id;
              const tags = barber.id === "amine"
                ? ["Skin Fades", "Classic Cuts", "Beard Art"]
                : barber.id === "youssef"
                ? ["Textured Hair", "Curls", "Modern Fades"]
                : ["Hot Shaves", "Kids Cuts", "Styling"];
              const years = barber.id === "amine" ? "8 Yrs" : barber.id === "youssef" ? "5 Yrs" : "4 Yrs";
              const fullRole = barber.id === "amine" ? "Master Barber" : "Senior Barber";
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
                        <span className="text-[11px] tracking-[0.08em] uppercase text-gold3 mt-0.5">{fullRole} · {years}</span>
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
                          {tags.map((tag) => (
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
            {BARBERS.map((barber) => {
              const tags = barber.id === "amine"
                ? ["Skin Fades", "Classic Cuts", "Beard Art"]
                : barber.id === "youssef"
                ? ["Textured Hair", "Curls", "Modern Fades"]
                : ["Hot Shaves", "Kids Cuts", "Styling"];
              const years = barber.id === "amine" ? "8 Yrs" : barber.id === "youssef" ? "5 Yrs" : "4 Yrs";
              const fullRole = barber.id === "amine" ? "Master Barber" : "Senior Barber";
              return (
                <div key={barber.id} className="group bg-ink border border-[rgb(254_251_243/10%)] rounded-[18px] overflow-hidden transition-[border-color,transform] duration-300 hover:border-[rgb(192_154_90/40%)] hover:-translate-y-1.5">
                  <div className="relative h-[300px] bg-[#161208] flex items-center justify-center">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,rgb(192_154_90/7%),transparent_70%)]" />
                    <div className="relative w-24 h-24 rounded-full bg-[rgb(192_154_90/10%)] border-[1.5px] border-[rgb(192_154_90/35%)] flex items-center justify-center font-playfair text-[38px] font-normal text-gold3">
                      {barber.shortName}
                    </div>
                  </div>
                  <div className="p-7">
                    <div className="font-playfair text-[26px] font-normal text-brand-white mb-0.5">{barber.name}</div>
                    <div className="text-xs text-gold3 tracking-[0.08em] uppercase mb-4">{fullRole} · {years}</div>
                    <div className="flex flex-wrap gap-[7px]">
                      {tags.map((tag) => (
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

      <div className="quote-sec">
        <div className="qbody">
          <span className="qmark">&quot;</span>
          <p className="qtext">
            Your chair is waiting. Your best look is one appointment <em>away.</em>
          </p>
          <cite className="qcite">Desart — Marrakech, Since 2019</cite>
        </div>
      </div>

      <section id="locations">
        <div className="loc-inner">
          <div className="loc-head">
            <div>
              <div className="sl">Find Us</div>
              <h2 className="sh2">
                Our <em>Locations</em>
              </h2>
            </div>
            <p className="slead">Visit us at the salon or let us come to you — your call.</p>
          </div>
          <div className="loc-cards">
            <div className="lic">
              <h3>Desart Salon</h3>
              <span className="ltag">Flagship Location</span>
              <div className="ld">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <p>
                  14 Rue Mohammed V, Medína
                  <br />
                  Marrakech 40000, Morocco
                </p>
              </div>
              <div className="ld">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
                <p>+212 600 000 000</p>
              </div>
              <div className="lhours">
                <div className="lhr">
                  <span className="day">Saturday – Thursday</span>
                  <span className="time">9:00 – 17:00</span>
                </div>
                <div className="lhr">
                  <span className="day">Friday</span>
                  <span className="time">Closed</span>
                </div>
              </div>
              <button type="button" className="loc-cta open-booking" onClick={openModal}>
                Book This Location →
              </button>
            </div>

            <div className="lic">
              <h3>Home Visit</h3>
              <span className="ltag">+30 MAD Travel Fee</span>
              <div className="ld">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <p>We travel anywhere within Marrakech city limits. Just provide your address at booking.</p>
              </div>
              <div className="ld">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p>Sat–Thu · 9:00 – 17:00. Same barbers, same quality, at your door.</p>
              </div>
              <div className="ld">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <p>Cash payment on the day. No card required at booking.</p>
              </div>
              <button type="button" className="loc-cta open-booking" onClick={openModal}>
                Book Home Visit →
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div className="fbrand">
              <span className="flogo">DESART</span>
              <p>
                Premium barbershop experience in the heart of Marrakech. Walk-ins welcome, appointments preferred. Cash
                only — always.
              </p>
            </div>
            <div className="fcol">
              <h4>Navigate</h4>
              <ul>
                <li>
                  <a href="#services">Services</a>
                </li>
                <li>
                  <a href="#team">Our Team</a>
                </li>
                <li>
                  <a href="#locations">Locations</a>
                </li>
                <li>
                  <button type="button" className="open-booking" onClick={openModal}>
                    Book Now
                  </button>
                </li>
              </ul>
            </div>
            <div className="fcol">
              <h4>Contact</h4>
              <ul>
                <li>14 Rue Mohammed V, Marrakech</li>
                <li>
                  <a href="tel:+212600000000">+212 600 000 000</a>
                </li>
                <li>Sat–Thu: 9:00 – 17:00</li>
                <li>Friday: Closed</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2025 Desart. Cash only · Marrakech, Morocco</p>
            <div className="fsocial">
              <a className="fsoc" href="#" aria-label="Instagram">
                <svg viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a className="fsoc" href="#" aria-label="TikTok">
                <svg viewBox="0 0 24 24">
                  <path d="M9 12a4 4 0 104 4V4a5 5 0 005 5" />
                </svg>
              </a>
              <a className="fsoc" href="#" aria-label="WhatsApp">
                <svg viewBox="0 0 24 24">
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
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
                {step > 1 && step < 6 && (
                  <button type="button" className="w-8 h-8 flex items-center justify-center bg-none border-none cursor-pointer text-brand-black rounded-lg transition-[background,color] duration-200 shrink-0 p-0 hover:bg-[rgb(10_8_0/6%)] active:bg-[rgb(10_8_0/10%)]" onClick={prevStep} aria-label="Go back">
                    <svg viewBox="0 0 9 16" width="9" height="16">
                      <path d="M8 1L1 8l7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
                  <p className="text-[15px] font-bold text-brand-black m-0 text-left tracking-[-0.01em] transition-[opacity,transform] duration-200" id="panel-title">
                    {step === 1 && "Reserve Your Session"}
                    {step === 2 && "Choose Your Barber"}
                    {step === 3 && "Select Services"}
                    {step === 4 && "Pick a Time"}
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
                <div id="step-1" className={stepPanelClassName(1)}>
                  <p className="text-[13px] text-[rgb(10_8_0/55%)] mb-[18px] leading-relaxed font-normal">Where would you like your appointment?</p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {LOCATIONS.map((location) => {
                      const isLocationSelected = selectedLocation?.id === location.id;
                      return (
                        <button
                          key={location.id}
                          type="button"
                          className={`flex items-center gap-3.5 rounded-2xl px-[18px] py-3.5 text-left transition-all duration-200 relative ${isLocationSelected ? "border-[1.5px] border-gold bg-gold" : "border-[1.5px] border-[rgb(10_8_0/12%)] bg-[rgb(10_8_0/4%)] hover:border-[rgb(10_8_0/28%)] hover:bg-[rgb(10_8_0/7%)] hover:-translate-y-0.5"}`}
                          onClick={() => setSelectedLocation(location)}
                        >
                          <div className={`relative flex items-center justify-center shrink-0 w-[38px] h-[38px] rounded-[10px] ${isLocationSelected ? "bg-[rgb(255_255_255/25%)]" : "bg-[rgb(10_8_0/6%)]"}`}>
                            {location.id === "salon" ? (
                              <svg className={`w-5 h-5 transition-[opacity,color] duration-200 ${isLocationSelected ? "opacity-100 text-white" : "opacity-70 text-brand-black"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                              </svg>
                            ) : (
                              <svg className={`w-5 h-5 transition-[opacity,color] duration-200 ${isLocationSelected ? "opacity-100 text-white" : "opacity-70 text-brand-black"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[15px] font-semibold mb-1 tracking-[-0.01em] leading-snug ${isLocationSelected ? "text-white" : "text-brand-black"}`}>{location.name}</div>
                            <div className={`text-[13px] leading-[1.55] font-normal ${isLocationSelected ? "text-white" : "text-[rgb(10_8_0/55%)]"}`}>
                              {location.id === "salon" ? (
                                <>
                                  14 Rue Mohammed V, Marrakech, Medina
                                  <div className={`h-1.5 ${isLocationSelected ? "opacity-40" : ""}`} />
                                  Sat–Thu · 9:00–17:00
                                </>
                              ) : (
                                <>
                                  We travel to your address in Marrakech city
                                  <div className={`h-1.5 ${isLocationSelected ? "opacity-40" : ""}`} />
                                  +30 MAD travel fee
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div id="step-2" className={stepPanelClassName(2)}>
                  <p className="text-[13px] text-[rgb(10_8_0/55%)] mb-[18px] leading-relaxed font-normal">Choose your barber — each one brings a unique style.</p>
                  <div className="flex flex-col gap-2">
                    {BARBERS.map((barber) => {
                      const isBarberSelected = selectedBarber?.id === barber.id;
                      return (
                        <button
                          key={barber.id}
                          type="button"
                          className={`flex items-center gap-3.5 rounded-2xl px-[18px] py-4 text-left bg-white transition-all duration-250 relative ${isBarberSelected ? "border-[1.5px] border-gold shadow-[0_4px_16px_rgb(192_154_90/15%),0_2px_6px_rgb(0_0_0/4%)]" : "border-[1.5px] border-[rgb(10_8_0/7%)] shadow-[0_1px_3px_rgb(0_0_0/4%)] hover:border-[rgb(10_8_0/15%)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgb(0_0_0/6%)]"}`}
                          onClick={() => setSelectedBarber(barber)}
                        >
                          <div className="relative flex items-center justify-center shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-playfair text-[15px] font-medium transition-[border-color,background] duration-250 ${isBarberSelected ? "border-2 border-gold bg-[linear-gradient(135deg,rgb(192_154_90/18%),rgb(192_154_90/10%))]" : "border-2 border-[rgb(192_154_90/20%)] bg-[linear-gradient(135deg,rgb(192_154_90/12%),rgb(192_154_90/6%))] text-gold2"}`}>{barber.shortName}</div>
                            {isBarberSelected && (
                              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-gold flex items-center justify-center text-white shadow-[0_2px_6px_rgb(192_154_90/30%)] animate-badge-pop">
                                <svg viewBox="0 0 24 24" width="10" height="10">
                                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[15px] font-semibold text-brand-black mb-px tracking-[-0.01em] leading-snug">{barber.name.split(" ")[0]}</div>
                            <div className="text-xs text-[rgb(10_8_0/55%)] font-medium tracking-[0.02em] uppercase">{barber.role}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div id="step-3" className={stepPanelClassName(3)}>
                  <p className="text-[13px] text-[rgb(10_8_0/55%)] mb-[18px] leading-relaxed font-normal">Select one or more services — cash payment at time of service.</p>
                  <div className="flex flex-col gap-2">
                    {SERVICES.map((service) => {
                      const isServiceSelected = selectedServices.some((s) => s.id === service.id);
                      return (
                        <button
                          key={service.id}
                          type="button"
                          className={`flex items-center justify-between rounded-xl px-4 py-3.5 bg-white transition-all duration-250 ${isServiceSelected ? "border-[1.5px] border-gold bg-[rgb(192_154_90/4%)] shadow-[0_2px_8px_rgb(192_154_90/10%)]" : "border-[1.5px] border-[rgb(10_8_0/7%)] shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/15%)] hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"}`}
                          onClick={() => toggleService(service)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-[22px] h-[22px] rounded-md shrink-0 flex items-center justify-center transition-[border-color,background,transform] duration-200 ${isServiceSelected ? "border-[1.5px] border-gold bg-gold scale-105" : "border-[1.5px] border-[rgb(10_8_0/14%)] bg-white"}`}>
                              <svg className="w-[11px] h-[11px] stroke-white fill-none stroke-[2.5] transition-opacity duration-150" viewBox="0 0 24 24" style={{ opacity: isServiceSelected ? 1 : 0, transition: "opacity 0.15s ease" }}>
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <div className="text-sm font-semibold text-brand-black tracking-[-0.01em]">{service.name}</div>
                              <div className="text-[11px] text-[rgb(10_8_0/40%)] font-medium">{service.duration} min</div>
                            </div>
                          </div>
                          <span className="text-[15px] font-bold text-brand-black tracking-[-0.02em]">{service.price} MAD</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div id="step-4" className={stepPanelClassName(4)}>
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
                      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {dateSlots.map((slot) => {
                          const isDateSelected = selectedDate?.id === slot.id;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              className={`shrink-0 min-w-[56px] rounded-xl px-2 py-2.5 text-center transition-all duration-250 ${isDateSelected ? "border-[1.5px] border-gold bg-gold shadow-[0_4px_12px_rgb(192_154_90/25%)]" : "border-[1.5px] border-[rgb(10_8_0/7%)] bg-white shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/15%)] hover:-translate-y-px hover:shadow-[0_3px_8px_rgb(0_0_0/5%)]"}`}
                              onClick={() => setSelectedDate(slot)}
                            >
                              <div className={`text-[9px] uppercase tracking-[0.08em] mb-1 font-semibold transition-colors duration-200 ${isDateSelected ? "text-[rgb(255_255_255/80%)]" : "text-[rgb(10_8_0/40%)]"}`}>{slot.shortDay}</div>
                              <div className={`text-lg font-bold tracking-[-0.02em] transition-colors duration-200 ${isDateSelected ? "text-white" : "text-brand-black"}`}>{slot.displayDate.split(" ")[0]}</div>
                              <div className={`text-[9px] font-medium uppercase tracking-[0.06em] mt-0.5 transition-colors duration-200 ${isDateSelected ? "text-[rgb(255_255_255/80%)]" : "text-[rgb(10_8_0/35%)]"}`}>{slot.displayDate.split(" ")[1]}</div>
                            </button>
                          );
                        })}
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
                              className={`rounded-[10px] px-1.5 py-2.5 text-center text-[13px] font-semibold tracking-[-0.01em] transition-all duration-250 ${isTimeSelected ? "border-[1.5px] border-gold bg-brand-black text-gold3 shadow-[0_4px_12px_rgb(0_0_0/15%)]" : "border-[1.5px] border-[rgb(10_8_0/7%)] bg-white text-brand-black shadow-[0_1px_2px_rgb(0_0_0/3%)] hover:border-[rgb(10_8_0/15%)] hover:-translate-y-px hover:shadow-[0_3px_8px_rgb(0_0_0/5%)]"}`}
                              onClick={() => setSelectedTime(slot)}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div id="step-5" className={stepPanelClassName(5)}>
                  <div className="bg-white rounded-2xl border border-[rgb(10_8_0/6%)] px-[18px] py-4 mb-[22px] flex flex-col gap-0 shadow-[0_1px_3px_rgb(0_0_0/4%)]">
                    <div className="font-playfair text-[11px] font-bold tracking-[0.12em] uppercase text-[rgb(10_8_0/40%)] mb-3 pb-2.5 border-b border-[rgb(10_8_0/6%)]">Booking Summary</div>
                    <div className="flex justify-between items-center text-[13px] text-brand-black gap-3 py-2 border-t border-[rgb(10_8_0/4%)]">
                      <span className="opacity-50 flex items-center gap-[5px] text-xs font-medium">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 shrink-0">
                          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        Location
                      </span>
                      <span>{selectedLocation?.description ?? "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-[13px] text-brand-black gap-3 py-2 border-t border-[rgb(10_8_0/4%)]">
                      <span className="opacity-50 flex items-center gap-[5px] text-xs font-medium">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 shrink-0">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        Barber
                      </span>
                      <span>{selectedBarber?.name ?? "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-[13px] text-brand-black gap-3 py-2 border-t border-[rgb(10_8_0/4%)]">
                      <span className="opacity-50 flex items-center gap-[5px] text-xs font-medium">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 shrink-0">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        Services
                      </span>
                      <span>{selectedServicesLabel || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-[13px] text-brand-black gap-3 py-2 border-t border-[rgb(10_8_0/4%)]">
                      <span className="opacity-50 flex items-center gap-[5px] text-xs font-medium">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 shrink-0">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        Date & Time
                      </span>
                      <span>
                        {selectedDate?.fullDate ?? "—"} {selectedTime ? `· ${selectedTime}` : ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[13px] text-brand-black gap-3 pt-3 mt-1 border-t border-[rgb(10_8_0/8%)]">
                      <span className="opacity-50 flex items-center gap-[5px] text-xs font-medium">Total</span>
                      <span className="text-[17px] font-bold text-gold tracking-[-0.02em]">{total} MAD</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="f-first" className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[rgb(10_8_0/40%)]">First Name</label>
                      <input
                        id="f-first"
                        type="text"
                        placeholder="Mohamed"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        className="bg-white border-[1.5px] border-[rgb(10_8_0/8%)] rounded-[10px] px-3.5 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/2%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/15%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="f-last" className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[rgb(10_8_0/40%)]">Last Name</label>
                      <input
                        id="f-last"
                        type="text"
                        placeholder="Alaoui"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        className="bg-white border-[1.5px] border-[rgb(10_8_0/8%)] rounded-[10px] px-3.5 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/2%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/15%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 max-sm:col-span-1">
                      <label htmlFor="f-phone" className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[rgb(10_8_0/40%)]">Phone Number</label>
                      <input
                        id="f-phone"
                        type="tel"
                        placeholder="+212 6XX XXX XXX"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className="bg-white border-[1.5px] border-[rgb(10_8_0/8%)] rounded-[10px] px-3.5 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/2%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/15%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 max-sm:col-span-1">
                      <label htmlFor="f-email" className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[rgb(10_8_0/40%)]">
                        Email <span className="text-[rgb(10_8_0/28%)] font-normal normal-case tracking-normal">(optional)</span>
                      </label>
                      <input
                        id="f-email"
                        type="email"
                        placeholder="your@email.com"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="bg-white border-[1.5px] border-[rgb(10_8_0/8%)] rounded-[10px] px-3.5 py-3 font-dm-sans text-sm text-brand-black outline-none transition-[border-color,box-shadow,background] duration-200 shadow-[0_1px_2px_rgb(0_0_0/2%)] placeholder:text-[rgb(10_8_0/25%)] hover:border-[rgb(10_8_0/15%)] focus:border-gold focus:shadow-[0_0_0_3px_rgb(192_154_90/12%),0_1px_3px_rgb(0_0_0/4%)] focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-[rgb(10_8_0/45%)] leading-relaxed mt-4 flex items-start gap-2 px-3.5 py-3 bg-[rgb(192_154_90/5%)] rounded-[10px] border border-[rgb(192_154_90/10%)]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 shrink-0 mt-px opacity-40 text-gold">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    Cash only, due at time of service. Free cancellations — just let us know.
                  </div>
                </div>

                <div id="step-6" className={stepPanelClassName(6)}>
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
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
