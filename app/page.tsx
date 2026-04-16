"use client";

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
const HERO_VIDEOS = ["/videos/hero-1.mp4", "/videos/hero-2.mp4", "/videos/hero-3.mp4", "/videos/hero-4.mp4"];

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
    description: "Timeless scissors or clipper work tailored to your face shape and lifestyle.",
    price: 60,
    duration: 45,
  },
  {
    id: "skinfade",
    name: "Skin Fade",
    description: "Clean gradient from skin to length — precision work that speaks for itself.",
    price: 100,
    duration: 60,
  },
  {
    id: "beard",
    name: "Beard Trim",
    description: "Sculpted lines, defined edges and a perfectly shaped beard to frame your face.",
    price: 50,
    duration: 30,
  },
  {
    id: "shave",
    name: "Hot Towel Shave",
    description: "The full ritual — warm towel, premium lather, straight razor. Pure luxury.",
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

  const nextStep = () => {
    if (!canContinue || isSubmitting) return;

    if (step === 5) {
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
    setStep((current) => Math.max(current - 1, 1));
  };

  const stepPanelClassName = (panelStep: number) =>
    `step-panel${step === panelStep ? " active" : ""}${step === panelStep && direction === "back" ? " back" : ""}`;

  return (
    <>
      <nav id="main-nav" className={isScrolled ? "scrolled" : undefined}>
        <a className="nav-logo" href="#">
          THE FADE
        </a>
        <ul className="nav-links">
          <li>
            <a href="#services">Services</a>
          </li>
          <li>
            <a href="#team">Team</a>
          </li>
          <li>
            <a href="#locations">Locations</a>
          </li>
        </ul>
        <button type="button" className="nav-cta open-booking" onClick={openModal}>
          Book Now
        </button>
        <button type="button" className="nav-hamburger" aria-label="Menu">
          <span />
          <span />
          <span />
        </button>
      </nav>

      <section className="hero">
        <div className="hero-split">
          <div className="hero-text-side">
            <div className="hero-content hero-content-split">
              <h1 className="hero-h1">
                Sharp <em>cuts.</em>
                <br />
                <span className="ol">Sharper</span> style.
              </h1>
              <p className="hero-sub">
                Premium grooming for those who know the difference. Walk in looking good — walk out looking exceptional.
              </p>
              <button type="button" className="btn-gold hero-cta-btn open-booking" onClick={openModal}>
                Book Now
              </button>
            </div>
            <div className="hero-scroll hero-scroll-split">
              <div className="hero-scroll-track">
                <div className="hero-scroll-thumb" />
              </div>
            </div>
          </div>

          <div className="hero-video-grid">
            <div className="vg-grid-inner">
              <div className="vg-col vg-col-down">
                <div className="vg-track">
                  {[HERO_VIDEOS[0], HERO_VIDEOS[1], HERO_VIDEOS[2], HERO_VIDEOS[3], HERO_VIDEOS[0], HERO_VIDEOS[1], HERO_VIDEOS[2], HERO_VIDEOS[3]].map((src, i) => (
                    <div className="vg-cell" key={`c1-${i}`}>
                      <video autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
                        <source src={src} type="video/mp4" />
                      </video>
                    </div>
                  ))}
                </div>
              </div>
              <div className="vg-col vg-col-up">
                <div className="vg-track">
                  {[HERO_VIDEOS[1], HERO_VIDEOS[3], HERO_VIDEOS[0], HERO_VIDEOS[2], HERO_VIDEOS[1], HERO_VIDEOS[3], HERO_VIDEOS[0], HERO_VIDEOS[2]].map((src, i) => (
                    <div className="vg-cell" key={`c2-${i}`}>
                      <video autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
                        <source src={src} type="video/mp4" />
                      </video>
                    </div>
                  ))}
                </div>
              </div>
              <div className="vg-col vg-col-down">
                <div className="vg-track">
                  {[HERO_VIDEOS[2], HERO_VIDEOS[0], HERO_VIDEOS[3], HERO_VIDEOS[1], HERO_VIDEOS[2], HERO_VIDEOS[0], HERO_VIDEOS[3], HERO_VIDEOS[1]].map((src, i) => (
                    <div className="vg-cell" key={`c3-${i}`}>
                      <video autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
                        <source src={src} type="video/mp4" />
                      </video>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="vg-fade vg-fade-top" />
            <div className="vg-fade vg-fade-bottom" />
          </div>
        </div>
      </section>

      <section id="services">
        <div className="svc-inner">
          <div className="svc-head">
            <div>
              <div className="sl">What We Do</div>
              <h2 className="sh2">
                Our <em>Services</em>
              </h2>
            </div>
            <p className="slead">Every cut is a craft. We take the time to get it right — every single time.</p>
          </div>
          <div className="svc-grid">
            {SERVICES.map((service) => (
              <div className="sc" key={service.id}>
                {service.id === "haircut" && (
                  <svg className="sc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M6 3v18M6 3c4 0 8 3 6 9S6 21 6 21M18 9v6M18 9c-2-4-6-3-6-3M18 15c-2 4-6 3-6 3" />
                  </svg>
                )}
                {service.id === "skinfade" && (
                  <svg className="sc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="5" />
                    <circle cx="12" cy="12" r="1" />
                    <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
                  </svg>
                )}
                {service.id === "beard" && (
                  <svg className="sc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                    <path d="M8 7V5a4 4 0 018 0v2M12 11v4" />
                  </svg>
                )}
                {service.id === "shave" && (
                  <svg className="sc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <path d="M9 9h.01M15 9h.01" />
                  </svg>
                )}
                <div className="sc-name">{service.name}</div>
                <div className="sc-desc">{service.description}</div>
                <div className="sc-meta">
                  <span className="sc-price">{service.price} MAD</span>
                  <span className="sc-dur">{service.duration} min</span>
                </div>
              </div>
            ))}
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

      <section id="team">
        <div className="team-inner">
          <div style={{ marginBottom: "56px" }}>
            <div className="sl">The Craftsmen</div>
            <h2 className="sh2">
              Meet Our <em>Team</em>
            </h2>
            <p className="slead">Every one of our barbers brings a distinct edge. Pick your style, pick your pro.</p>
          </div>
          <div className="team-grid">
            <div className="bc">
              <div className="bc-img">
                <div className="bc-av">AK</div>
              </div>
              <div className="bc-body">
                <div className="bc-name">Amine Karimi</div>
                <div className="bc-role">Master Barber · 8 Yrs</div>
                <div className="bc-tags">
                  <span className="bt">Skin Fades</span>
                  <span className="bt">Classic Cuts</span>
                  <span className="bt">Beard Art</span>
                </div>
              </div>
            </div>
            <div className="bc">
              <div className="bc-img">
                <div className="bc-av">YB</div>
              </div>
              <div className="bc-body">
                <div className="bc-name">Youssef Benali</div>
                <div className="bc-role">Senior Barber · 5 Yrs</div>
                <div className="bc-tags">
                  <span className="bt">Textured Hair</span>
                  <span className="bt">Curls</span>
                  <span className="bt">Modern Fades</span>
                </div>
              </div>
            </div>
            <div className="bc">
              <div className="bc-img">
                <div className="bc-av">KM</div>
              </div>
              <div className="bc-body">
                <div className="bc-name">Karim Mansouri</div>
                <div className="bc-role">Senior Barber · 4 Yrs</div>
                <div className="bc-tags">
                  <span className="bt">Hot Shaves</span>
                  <span className="bt">Kids Cuts</span>
                  <span className="bt">Styling</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="quote-sec">
        <div className="qbody">
          <span className="qmark">&quot;</span>
          <p className="qtext">
            Your chair is waiting. Your best look is one appointment <em>away.</em>
          </p>
          <cite className="qcite">The Fade — Marrakech, Since 2019</cite>
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
              <h3>The Fade Salon</h3>
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
              <span className="flogo">THE FADE</span>
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
            <p>© 2025 The Fade. Cash only · Marrakech, Morocco</p>
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

      <button type="button" className="float-book open-booking" onClick={openModal}>
        <div className="fpulse" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        Book Now
      </button>

      <div
        id="modal-overlay"
        className={`modal-overlay${isModalOpen ? " open" : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeModal();
          }
        }}
      >
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="mhdr">
            <div className="mtop">
              <span className="mtitle" id="modal-title">
                {step === 1 && "Reserve Your Session"}
                {step === 2 && "Choose Your Barber"}
                {step === 3 && "Select Services"}
                {step === 4 && "Pick a Time"}
                {step === 5 && "Your Details"}
                {step === 6 && ""}
              </span>
              <button type="button" className="mclose close-booking" onClick={closeModal}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {step < 6 && (
              <div className="prog-bar" id="prog-bar">
                {STEP_LABELS.map((label, index) => {
                  const stepNumber = index + 1;
                  const isDone = step > stepNumber;
                  const isActive = step === stepNumber;
                  return (
                    <div key={label} className={`ps ${isDone ? "done" : ""} ${isActive ? "active" : ""}`} data-s={stepNumber}>
                      <div className="pc">
                        {isDone ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          stepNumber
                        )}
                      </div>
                      <span className="pl">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mbody">
            <div id="step-1" className={stepPanelClassName(1)}>
              <p className="sq">Where would you like your appointment?</p>
              <div className="lg2">
                {LOCATIONS.map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    className={`lc2 ${selectedLocation?.id === location.id ? "selected" : ""}`}
                    onClick={() => setSelectedLocation(location)}
                  >
                    {location.id === "salon" ? (
                      <svg className="lc2-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    ) : (
                      <svg className="lc2-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    )}
                    <div className="lc2-name">{location.name}</div>
                    <div className="lc2-desc">
                      {location.id === "salon" ? (
                        <>
                          14 Rue Mohammed V
                          <br />
                          Marrakech, Medina
                          <br />
                          <br />
                          Sat–Thu · 9:00–17:00
                        </>
                      ) : (
                        <>
                          We travel to your address in Marrakech city.
                          <br />
                          <br />
                          +30 MAD travel fee
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div id="step-2" className={stepPanelClassName(2)}>
              <p className="sq">Choose your barber — each one brings a unique style.</p>
              <div className="bpg">
                {BARBERS.map((barber) => (
                  <button
                    key={barber.id}
                    type="button"
                    className={`bp ${selectedBarber?.id === barber.id ? "selected" : ""}`}
                    onClick={() => setSelectedBarber(barber)}
                  >
                    <div className="bp-av">{barber.shortName}</div>
                    <div className="bp-name">{barber.name.split(" ")[0]}</div>
                    <div className="bp-role">{barber.role}</div>
                  </button>
                ))}
              </div>
            </div>

            <div id="step-3" className={stepPanelClassName(3)}>
              <p className="sq">Select one or more services — cash payment at time of service.</p>
              <div className="spl">
                {SERVICES.map((service) => {
                  const isSelected = selectedServices.some((selectedService) => selectedService.id === service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      className={`sp ${isSelected ? "selected" : ""}`}
                      onClick={() => toggleService(service)}
                    >
                      <div className="sp-l">
                        <div className="sp-chk">
                          <svg viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        <div>
                          <div className="sp-name">{service.name}</div>
                          <div className="sp-dur">{service.duration} min</div>
                        </div>
                      </div>
                      <span className="sp-price">{service.price} MAD</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div id="step-4" className={stepPanelClassName(4)}>
              <p className="sq">Pick a date and time that works for you. (9:00 – 17:00, Fridays closed)</p>
              <div className="dt-wrap">
                <div>
                  <div className="dtlbl">Date</div>
                  <div className="date-slots">
                    {dateSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className={`ds ${selectedDate?.id === slot.id ? "selected" : ""}`}
                        onClick={() => setSelectedDate(slot)}
                      >
                        <div className="ds-d">{slot.shortDay}</div>
                        <div className="ds-n">{slot.displayDate}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="dtlbl">Time</div>
                  <div className="tg">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`ts ${selectedTime === slot ? "selected" : ""}`}
                        onClick={() => setSelectedTime(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div id="step-5" className={stepPanelClassName(5)}>
              <div className="sumbox">
                <div className="sr">
                  <span className="sl2">Location</span>
                  <span>{selectedLocation?.description ?? "—"}</span>
                </div>
                <div className="sr">
                  <span className="sl2">Barber</span>
                  <span>{selectedBarber?.name ?? "—"}</span>
                </div>
                <div className="sr">
                  <span className="sl2">Services</span>
                  <span>{selectedServicesLabel || "—"}</span>
                </div>
                <div className="sr">
                  <span className="sl2">Date & Time</span>
                  <span>
                    {selectedDate?.fullDate ?? "—"} {selectedTime ? `· ${selectedTime}` : ""}
                  </span>
                </div>
                <div className="sr tot">
                  <span className="sl2">Total (cash)</span>
                  <span className="sv">{total} MAD</span>
                </div>
              </div>

              <div className="fg">
                <div className="ff">
                  <label htmlFor="f-first">First Name</label>
                  <input
                    id="f-first"
                    type="text"
                    placeholder="Mohamed"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </div>
                <div className="ff">
                  <label htmlFor="f-last">Last Name</label>
                  <input
                    id="f-last"
                    type="text"
                    placeholder="Alaoui"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </div>
                <div className="ff full">
                  <label htmlFor="f-phone">Phone Number</label>
                  <input
                    id="f-phone"
                    type="tel"
                    placeholder="+212 6XX XXX XXX"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
                <div className="ff full">
                  <label htmlFor="f-email">
                    Email <span>(optional)</span>
                  </label>
                  <input
                    id="f-email"
                    type="email"
                    placeholder="your@email.com"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              <div className="fnote">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                Cash only, due at time of service. Free cancellations — just let us know.
              </div>
            </div>

            <div id="step-6" className={stepPanelClassName(6)}>
              <div className="succ-wrap">
                <div className="sc-ck">
                  <svg viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="sc-h">You&apos;re all set!</h2>
                <p className="sc-p">Your appointment has been received. We&apos;ll reach out to confirm within a few hours.</p>
                <div className="sc-det">
                  <div className="sr">
                    <span className="sl2">Name</span>
                    <span>
                      {firstName} {lastName}
                    </span>
                  </div>
                  <div className="sr">
                    <span className="sl2">Date & Time</span>
                    <span>
                      {selectedDate?.fullDate} · {selectedTime}
                    </span>
                  </div>
                  <div className="sr">
                    <span className="sl2">Barber</span>
                    <span>{selectedBarber?.name}</span>
                  </div>
                  <div className="sr">
                    <span className="sl2">Services</span>
                    <span>{selectedServicesLabel}</span>
                  </div>
                  <div className="sr tot">
                    <span className="sl2">Total</span>
                    <span className="sv">{total} MAD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {step < 6 ? (
            <div className="mfoot" id="modal-footer">
              <span className="cpill">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Cash only
              </span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {step > 1 && (
                  <button type="button" className="btn-bk" id="btn-back" onClick={prevStep}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    Back
                  </button>
                )}
                {isSubmitting ? (
                  <div className="snd">
                    <div className="spnr" />
                    Sending confirmation…
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-nx"
                    id="btn-next"
                    onClick={nextStep}
                    disabled={!canContinue}
                  >
                    {step === 5 ? "Confirm Booking" : "Continue"}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mfoot" id="modal-footer" style={{ justifyContent: "center" }}>
              <button type="button" className="btn-nx" onClick={finishBooking}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
