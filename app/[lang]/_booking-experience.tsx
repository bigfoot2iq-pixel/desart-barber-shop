"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { DictionaryProvider, useT } from "@/lib/i18n/client-dictionary";
import { formatMoney } from "@/lib/i18n/format";
import { DesktopVideoGrid, MobileVideoCarousel } from "@/app/components/video-grid";
import { BeforeAfterSection } from "@/app/components/before-after";
import { LocaleSwitcher } from "@/app/components/locale-switcher";
import { getActiveProfessionalsWithServices, getActiveServices } from "@/lib/queries";
import type { ProfessionalWithServices } from "@/lib/queries/appointments";
import type { Locale } from "@/lib/i18n/config";

import { INSTAGRAM_URL } from "@/lib/seo/constants";
import type { BarberOption, ServiceOption } from "./_booking/types";
import type { BookingModalProps } from "./_booking/booking-modal";

const BookingModal = dynamic<BookingModalProps>(() => import("./_booking/booking-modal").then((m) => m.BookingModal), { ssr: false });

export interface BookingExperienceProps {
  locale: Locale;
  common: Record<string, unknown>;
  booking: Record<string, unknown>;
  userPanel: Record<string, unknown>;
}

function BookingExperienceInner({ locale, common, booking, userPanel }: BookingExperienceProps) {
  const tBooking = useT("booking");
  const tCommon = useT("common");
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [expandedTeamMember, setExpandedTeamMember] = useState<string | null>(null);

  const [isLoadingBarbers, setIsLoadingBarbers] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  useEffect(() => {
    setIsLoadingBarbers(true);
    getActiveProfessionalsWithServices(locale as import("@/lib/i18n/config").Locale)
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
    getActiveServices(locale as import("@/lib/i18n/config").Locale)
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
  }, [locale]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 60);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const openModal = () => {
    setIsModalOpen(true);
  };

  const prefetchModal = () => {
    void import("./_booking/booking-modal");
  };

  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <nav id="main-nav" className={`fixed top-0 left-0 right-0 z-[300] flex items-center justify-between lg:px-[100px] px-[56px] py-5 transition-[background,padding] duration-300 ${isScrolled ? "bg-[rgb(10_8_0/90%)] [backdrop-filter:blur(18px)] py-[14px] border-b border-[rgb(254_251_243/10%)]" : ""}`}>
        <div className="flex items-center gap-2.5 font-playfair text-2xl font-bold tracking-[0.14em] text-gold3">
          <Image src="/logo.jpg" alt="Desart" width={36} height={36} className="rounded-full object-cover shrink-0 md:w-9 md:h-9" priority />
          DESART
        </div>
        <div className="flex items-center gap-4">
          <LocaleSwitcher locale={locale} variant="light" />
        </div>
      </nav>

      <section className="relative bg-brand-black text-brand-white min-h-svh overflow-hidden grid grid-cols-1 gap-6 max-sm:gap-5 items-center pt-24 pb-10 max-sm:pt-28 px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:pt-[110px] lg:pb-0 lg:pr-0">

        {/* Header text — mobile row 1, desktop col 1 row 1 */}
        <div className="relative z-[3] max-w-[560px] order-1 lg:order-none lg:col-start-1 lg:row-start-1 lg:pl-[100px]">
          <span className="inline-flex items-center gap-2.5 text-gold3 mb-7 max-sm:mb-4 text-[11px] tracking-[.18em] uppercase font-medium before:content-[''] before:w-6 before:h-px before:bg-current">
            {tBooking('hero.tagline')}
          </span>
          <h1 className="font-fraunces font-normal text-[clamp(40px,5.5vw,76px)] leading-[.95] tracking-[-0.035em]">
            {tBooking('hero.headline1')}<br />
            {tBooking('hero.headline2')} <em className="italic font-normal text-gold3">{tBooking('hero.headline2Em')}</em>
          </h1>
          <p className="mt-6 max-sm:mt-4 text-brand-white/60 text-base max-sm:text-[15px] leading-[1.7] max-w-[440px] font-light">
            {tBooking('hero.subheadline')}
          </p>
        </div>

        {/* Videos — mobile row 3, desktop col 2 spanning both rows */}
        <div className="relative z-[2] overflow-hidden h-auto order-3 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:h-svh lg:-mt-[120px]">
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

        {/* CTAs + hours — mobile row 2 (above videos), desktop col 1 row 2 */}
        <div className="relative z-[3] max-w-[560px] order-2 lg:order-none lg:col-start-1 lg:row-start-2 lg:pl-[100px] lg:pb-20">
          <div className="flex gap-2.5 items-center flex-nowrap">
            <button
              type="button"
              onClick={openModal}
              onMouseEnter={prefetchModal}
              className="open-booking inline-flex items-center justify-center gap-2 px-[22px] py-[15px] max-sm:px-4 max-sm:py-[13px] bg-brand-white text-brand-black text-[11px] max-sm:text-[10px] tracking-[.16em] uppercase font-semibold border border-transparent transition-[transform,background-color] duration-150 hover:-translate-y-px hover:bg-gold3 whitespace-nowrap"
              data-testid="btn:open-booking"
            >
              {tBooking('hero.reserveCta')}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </button>
            <a
              href="#services"
              className="inline-flex items-center justify-center gap-2 px-[22px] py-[15px] max-sm:px-4 max-sm:py-[13px] text-brand-white border border-brand-white/25 text-[11px] max-sm:text-[10px] tracking-[.16em] uppercase font-semibold transition-[border-color,color] duration-150 hover:border-gold3 hover:text-gold3 whitespace-nowrap"
            >
              {tBooking('hero.viewMenuCta')}
            </a>
          </div>
          <div className="hidden lg:flex gap-8 flex-wrap mt-16 pt-6 border-t border-brand-white/10 text-brand-white/50">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] tracking-[.18em] uppercase font-medium">{tBooking('hero.hours')}</span>
              <span className="text-brand-white font-playfair text-[18px] tracking-[-0.01em]">{tBooking('hero.hours')}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] tracking-[.18em] uppercase font-medium">{tBooking('hero.payment')}</span>
              <span className="text-brand-white font-playfair text-[18px] tracking-[-0.01em]">{tBooking('hero.cashOnly')}</span>
            </div>
          </div>
        </div>

      </section>

      <BeforeAfterSection />

      <section id="services" className="bg-gold-bg text-brand-black py-12 px-4">
        <div className="max-w-[1160px] mx-auto">
          <div className="flex flex-col items-start gap-3 mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-5 sm:mb-14">
            <div>
              <div className="before:content-[''] before:w-[26px] before:h-px before:bg-current inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[0.22em] uppercase text-[rgb(10_8_0/55%)] mb-[14px]">{tBooking('services.eyebrow')}</div>
              <h2 className="font-playfair text-[clamp(40px,5vw,66px)] font-normal leading-[1.05] tracking-[-0.01em] mb-[14px] [&_em]:italic">{tBooking('services.title')}</h2>
            </div>
            <p className="text-[17px] font-light leading-[1.8] max-w-[480px] opacity-60">{tBooking('services.sublineCash')}</p>
          </div>

          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-[2px]">
            {services.map((service) => (
              <div className="group relative overflow-hidden bg-[rgb(10_8_0/7%)] p-8 lg:px-8 lg:pt-10 lg:pb-9 transition-[background] duration-250 hover:bg-[rgb(10_8_0/14%)]" key={service.id}>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-black scale-x-0 origin-left transition-transform duration-350 group-hover:scale-x-100" />
                <div className="font-playfair text-[22px] lg:text-[27px] font-normal mb-1.5">{service.name}</div>
                <div className="text-[13px] text-[rgb(10_8_0/50%)] leading-[1.7] mb-8">{service.description}</div>
                <div className="flex justify-between items-baseline mt-auto">
                  <span className="text-[20px] font-medium">{formatMoney(service.price, locale as import('@/lib/i18n/config').Locale)}</span>
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
                      <span className="text-[15px] font-medium">{formatMoney(service.price, locale as import('@/lib/i18n/config').Locale)}</span>
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
        <div className="flex whitespace-nowrap animate-marquee hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:animate-none">
          {[...Array(2)].flatMap((_, repeatIndex) =>
            Array.from({ length: 7 }, (_, i) => (
              <div
                className="inline-flex items-center gap-[26px] px-[26px] font-playfair text-[19px] font-normal italic text-brand-black shrink-0"
                key={`${i}-${repeatIndex}`}
              >
                {tBooking(`marquee.${i}`)} <span className="w-1 h-1 rounded-full bg-brand-black opacity-30 shrink-0" />
              </div>
            ))
          )}
        </div>
      </div>

      <section className="bg-brand-black text-brand-white py-12 px-4">
        <div className="max-w-[1160px] mx-auto">
          <div className="before:content-[''] before:w-[26px] before:h-px before:bg-current inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[0.22em] uppercase text-[rgb(254_251_243/50%)] mb-[14px]">{tBooking('reviews.eyebrow')}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-[rgb(254_251_243/5%)] border border-[rgb(254_251_243/10%)] rounded-[14px] p-7">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, s) => (
                    <svg key={s} className="w-4 h-4 text-gold3 fill-current" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.68l5.34-.78L10 1z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[15px] font-light leading-[1.75] text-[rgb(254_251_243/75%)] mb-5">{tBooking(`reviews.items.${i}.quote`)}</p>
                <span className="text-[12px] font-medium tracking-[0.06em] uppercase text-gold3">{tBooking(`reviews.items.${i}.name`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="team" className="bg-brand-black text-brand-white py-12 px-4">
        <div className="max-w-[1160px] mx-auto">
          <div className="flex flex-col items-start gap-3 mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-5 sm:mb-14">
            <div>
              <div className="before:content-[''] before:w-[26px] before:h-px before:bg-current inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[0.22em] uppercase text-[rgb(254_251_243/50%)] mb-[14px]">{tBooking('team.eyebrow')}</div>
              <h2 className="font-playfair text-[clamp(40px,5vw,66px)] font-normal leading-[1.05] tracking-[-0.01em] mb-[14px] [&_em]:italic text-brand-white">
                {tBooking('team.headline')} <em className="text-gold3">{tBooking('team.highlight')}</em>
              </h2>
              <p className="text-[17px] font-light leading-[1.8] max-w-[480px] opacity-60 text-[rgb(254_251_243/50%)]">{tBooking('team.subline')}</p>
            </div>
          </div>

          {/* Mobile: Accordion */}
          <div className="flex flex-col sm:hidden border-t border-[rgb(254_251_243/10%)]">
            {barbers.length === 0 && (
              <p className="text-center text-[rgb(254_251_243/40%)] py-10 text-[13px]">{tBooking('misc.loadingTeam')}</p>
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
                        <Image src={barber.imageUrl} alt={barber.name} fill className="object-cover" sizes="(min-width: 1024px) 33vw, 100vw" />
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
            {tBooking('closing.quote1')} <em className="not-italic text-gold3">{tBooking('closing.quote2')}</em>
          </p>
          <button
            type="button"
            onClick={openModal}
            onMouseEnter={prefetchModal}
            className="inline-flex items-center gap-2.5 px-[22px] py-[15px] bg-brand-white text-brand-black text-[11px] tracking-[.16em] uppercase font-semibold border border-transparent transition-[transform,background-color] duration-150 hover:-translate-y-px hover:bg-gold3 open-booking"
          >
            {tCommon('bookNow')}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="w-3.5 h-3.5"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <section id="locations" className="bg-gold-bg text-brand-black py-12 px-4">
        <div className="max-w-[1160px] mx-auto">
          <div className="flex items-end justify-between gap-5 flex-wrap mb-[50px]">
            <div>
              <div className="before:content-[''] before:w-[26px] before:h-px before:bg-current inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[0.22em] uppercase text-[rgb(10_8_0/55%)] mb-[14px]">{tBooking('locations.eyebrow')}</div>
              <h2 className="font-playfair text-[clamp(40px,5vw,66px)] font-normal leading-[1.05] tracking-[-0.01em] mb-[14px] [&_em]:italic">
                {tBooking('locations.headline')} <em>{tBooking('locations.highlight')}</em>
              </h2>
            </div>
            <p className="text-[17px] font-light leading-[1.8] max-w-[480px] opacity-60">{tBooking('locations.subline')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-[rgb(10_8_0/7%)] rounded-[18px] p-6 sm:p-11">
              <h3 className="font-playfair text-[30px] font-normal mb-[7px]">{tBooking('locations.salonName')}</h3>
              <span className="text-[11px] tracking-[0.12em] uppercase text-[rgb(10_8_0/55%)] mb-7 block">{tBooking('locations.flagship')}</span>
              <div className="flex items-start gap-3.5 mb-[18px]">
                <svg className="w-[18px] h-[18px] shrink-0 mt-px opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <p className="text-sm leading-[1.7] opacity-70">
                  {tBooking('locations.addressLine1')}
                  <br />
                  {tBooking('locations.addressLine2')}
                </p>
              </div>
              <div className="flex items-start gap-3.5 mb-[18px]">
                <svg className="w-[18px] h-[18px] shrink-0 mt-px opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
                <p className="text-sm leading-[1.7] opacity-70">{tBooking('footer.phone')}</p>
              </div>
              <div className="flex flex-col gap-0 mt-[18px]">
                <div className="flex justify-between text-[13px] py-2.5 border-b border-[rgb(10_8_0/10%)]">
                  <span className="opacity-50">{tBooking('locations.hoursSatThuLabel')}</span>
                  <span className="font-medium">{tBooking('hero.hours')}</span>
                </div>
                <div className="flex justify-between text-[13px] py-2.5 border-b border-[rgb(10_8_0/10%)]">
                  <span className="opacity-50">{tBooking('locations.hoursFridayLabel')}</span>
                  <span className="font-medium">{tBooking('locations.closedOnFriday')}</span>
                </div>
              </div>
              <button type="button" className="mt-8 bg-brand-black text-white text-[11px] font-medium tracking-[0.1em] uppercase py-[13px] px-7 rounded-[3px] inline-block cursor-pointer transition-all duration-200 hover:bg-ink hover:-translate-y-px open-booking" onClick={openModal} onMouseEnter={prefetchModal}>
                {tBooking('locations.bookLocationCta')} →
              </button>
            </div>

            <div className="bg-[rgb(10_8_0/7%)] rounded-[18px] p-6 sm:p-11">
              <h3 className="font-playfair text-[30px] font-normal mb-[7px]">{tBooking('locations.homeVisit')}</h3>
              <span className="text-[11px] tracking-[0.12em] uppercase text-[rgb(10_8_0/55%)] mb-7 block">{tBooking('locations.homeVisitFee')}</span>
              <div className="flex items-start gap-3.5 mb-[18px]">
                <svg className="w-[18px] h-[18px] shrink-0 mt-px opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <p className="text-sm leading-[1.7] opacity-70">{tBooking('locations.homeVisitBody')}</p>
              </div>
              <div className="flex items-start gap-3.5 mb-[18px]">
                <svg className="w-[18px] h-[18px] shrink-0 mt-px opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p className="text-sm leading-[1.7] opacity-70">{tBooking('locations.homeVisitHoursBody')}</p>
              </div>
              <div className="flex items-start gap-3.5 mb-[18px]">
                <svg className="w-[18px] h-[18px] shrink-0 mt-px opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <p className="text-sm leading-[1.7] opacity-70">{tBooking('locations.homeVisitCashNote')}</p>
              </div>
              <button type="button" className="mt-8 bg-brand-black text-white text-[11px] font-medium tracking-[0.1em] uppercase py-[13px] px-7 rounded-[3px] inline-block cursor-pointer transition-all duration-200 hover:bg-ink hover:-translate-y-px open-booking" onClick={openModal} onMouseEnter={prefetchModal}>
                {tBooking('locations.homeVisitCta')} →
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
                {tBooking('footer.tagline')}
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-medium tracking-[0.2em] uppercase text-gold3 mb-[22px]">{tBooking('footer.navigate')}</h4>
              <ul className="list-none flex flex-col gap-3">
                <li>
                  <a href="#services" className="text-sm text-[rgb(254_251_243/40%)] transition-colors duration-200 hover:text-white">{tCommon('services')}</a>
                </li>
                <li>
                  <a href="#team" className="text-sm text-[rgb(254_251_243/40%)] transition-colors duration-200 hover:text-white">{tCommon('ourTeam')}</a>
                </li>
                <li>
                  <a href="#locations" className="text-sm text-[rgb(254_251_243/40%)] transition-colors duration-200 hover:text-white">{tCommon('locations')}</a>
                </li>
                <li>
                  <a href={`/${locale}/services`} className="text-sm text-[rgb(254_251_243/40%)] transition-colors duration-200 hover:text-white">{tCommon('servicesPage.hero.title')}</a>
                </li>
                <li>
                  <a href={`/${locale}/a-domicile`} className="text-sm text-[rgb(254_251_243/40%)] transition-colors duration-200 hover:text-white">{tCommon('homeVisitPage.hero.eyebrow')}</a>
                </li>
                <li>
                  <button type="button" className="text-sm text-[rgb(254_251_243/40%)] p-0 transition-colors duration-200 hover:text-white open-booking" onClick={openModal} onMouseEnter={prefetchModal}>
                    {tCommon('bookNow')}
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-medium tracking-[0.2em] uppercase text-gold3 mb-[22px]">{tBooking('footer.contact')}</h4>
              <ul className="list-none flex flex-col gap-3">
                <li className="text-sm text-[rgb(254_251_243/40%)]">{tBooking('footer.address')}</li>
                <li>
                  <a href={`tel:${tBooking('footer.phoneHref')}`} className="text-sm text-[rgb(254_251_243/40%)] transition-colors duration-200 hover:text-white">{tBooking('footer.phone')}</a>
                </li>
                <li className="text-sm text-[rgb(254_251_243/40%)]">{tBooking('footer.hoursSatThu')}</li>
                <li className="text-sm text-[rgb(254_251_243/40%)]">{tBooking('footer.hoursFriday')}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[rgb(254_251_243/10%)] pt-7 flex justify-between items-center flex-wrap gap-3">
            <p className="text-[13px] text-[rgb(254_251_243/28%)]">{tBooking('footer.copyright')}</p>
            <div className="flex gap-3.5">
              <a className="w-[34px] h-[34px] rounded-full border border-[rgb(254_251_243/10%)] flex items-center justify-center text-[rgb(254_251_243/35%)] transition-all duration-200 hover:border-gold hover:text-gold" href={INSTAGRAM_URL} aria-label="Instagram" target="_blank" rel="noopener noreferrer">
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
            onMouseEnter={prefetchModal}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            {tCommon('bookNow')}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <BookingModal
            barbers={barbers}
            isModalOpen={isModalOpen}
            isLoadingBarbers={isLoadingBarbers}
            isLoadingServices={isLoadingServices}
            locale={locale}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export function BookingExperience(props: BookingExperienceProps) {
  return (
    <DictionaryProvider value={{ common: props.common, booking: props.booking, userPanel: props.userPanel }}>
      <BookingExperienceInner {...props} />
    </DictionaryProvider>
  );
}
