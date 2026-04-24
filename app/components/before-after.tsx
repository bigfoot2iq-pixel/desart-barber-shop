"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useT } from "@/lib/i18n/client-dictionary";
import { HERO_POSTERS } from "@/app/components/video-grid";

const OBSERVER_THRESHOLD = 0.15;

// TODO: replace with real before/after pairs once uploaded to the
// desart-barber-shop Supabase bucket (ba-1-before.jpg … ba-5-after.jpg).
const TRANSFORMATIONS = [
  { before: HERO_POSTERS[0], after: HERO_POSTERS[0] },
  { before: HERO_POSTERS[1], after: HERO_POSTERS[1] },
  { before: HERO_POSTERS[2], after: HERO_POSTERS[2] },
  { before: HERO_POSTERS[3], after: HERO_POSTERS[3] },
  { before: HERO_POSTERS[4], after: HERO_POSTERS[4] },
];

export function BeforeAfterSection() {
  const tBooking = useT("booking");
  const [activeIdx, setActiveIdx] = useState(0);
  const [pct, setPct] = useState(50);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: OBSERVER_THRESHOLD }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const updatePctFromClientX = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const next = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setPct(next);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    updatePctFromClientX(e.clientX);
  }, [updatePctFromClientX]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updatePctFromClientX(e.clientX);
  }, [updatePctFromClientX]);

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
    setHasInteracted(true);
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const shift = e.shiftKey;
    let next = pct;
    switch (e.key) {
      case "ArrowLeft":
        next = Math.max(0, pct - (shift ? 10 : 2));
        e.preventDefault();
        break;
      case "ArrowRight":
        next = Math.min(100, pct + (shift ? 10 : 2));
        e.preventDefault();
        break;
      case "Home":
        next = 0;
        e.preventDefault();
        break;
      case "End":
        next = 100;
        e.preventDefault();
        break;
      default:
        return;
    }
    setPct(next);
    setHasInteracted(true);
  }, [pct]);

  const selectTransformation = useCallback((index: number) => {
    setActiveIdx(index);
    setPct(50);
    setHasInteracted(false);
  }, []);

  const caption = tBooking(`beforeAfter.transformations.${activeIdx}.caption`) as string;

  return (
    <section
      ref={sectionRef}
      id="before-after"
      aria-labelledby="before-after-heading"
      className="bg-black2 text-brand-white py-20 px-4 sm:py-24 lg:py-28 border-t border-[rgb(192_154_90/0.12)]"
    >
      <div className="max-w-[1160px] mx-auto">
        {/* Header */}
        <div className="flex flex-col items-start gap-3 mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-5 sm:mb-14">
          <div>
            <div className="before:content-[''] before:w-[26px] before:h-px before:bg-current inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[0.22em] uppercase text-[rgb(254_251_243/0.5)] mb-[14px]">
              {tBooking("beforeAfter.eyebrow")}
            </div>
            <h2
              id="before-after-heading"
              className="font-playfair text-[clamp(40px,5vw,66px)] font-normal leading-[1.05] tracking-[-0.01em] mb-[14px] [&_em]:italic"
            >
              {tBooking("beforeAfter.headline")}{" "}
              <em className="italic text-gold3">{tBooking("beforeAfter.headlineEm")}</em>
            </h2>
          </div>
          <p className="text-[17px] font-light leading-[1.8] max-w-[520px] opacity-60">
            {tBooking("beforeAfter.subheadline")}
          </p>
        </div>

        {/* Slider */}
        <div
          className={`relative w-full overflow-hidden rounded-[18px] bg-[rgb(255_255_255/0.04)] ${!prefersReducedMotion && isVisible ? "animate-fade-up" : ""}`}
          style={{ touchAction: "none" }}
        >
          <div
            ref={containerRef}
            className="relative w-full aspect-[4/5] sm:aspect-[16/11] lg:aspect-[16/10] lg:max-h-[640px]"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* Before image (bottom/left) */}
            <img
              src={TRANSFORMATIONS[activeIdx].before}
              alt={`${caption} — ${tBooking("beforeAfter.beforeLabel")}`}
              className="absolute inset-0 w-full h-full object-cover select-none"
              loading="eager"
              decoding="async"
              draggable={false}
            />

            {/* After image (top/right) with clip */}
            <img
              src={TRANSFORMATIONS[activeIdx].after}
              alt={`${caption} — ${tBooking("beforeAfter.afterLabel")}`}
              className="absolute inset-0 w-full h-full object-cover select-none"
              loading="eager"
              decoding="async"
              draggable={false}
              style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
            />

            {/* Labels */}
            <span className="absolute top-3 left-3 sm:top-4 sm:left-4 text-[9px] sm:text-[10px] tracking-[0.22em] uppercase bg-brand-black/55 backdrop-blur-sm px-3 py-1.5 rounded-[3px] select-none pointer-events-none">
              {tBooking("beforeAfter.beforeLabel")}
            </span>
            <span className="absolute top-3 right-3 sm:top-4 sm:right-4 text-[9px] sm:text-[10px] tracking-[0.22em] uppercase bg-brand-black/55 backdrop-blur-sm px-3 py-1.5 rounded-[3px] select-none pointer-events-none">
              {tBooking("beforeAfter.afterLabel")}
            </span>

            {/* Divider + Handle */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-gold3"
              style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
            >
              {/* Handle */}
              <div
                tabIndex={0}
                role="slider"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
                aria-label={tBooking("beforeAfter.sliderAria") as string}
                onKeyDown={onKeyDown}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] lg:w-14 lg:h-14 rounded-full bg-gold3 border-[3px] border-brand-white/95 shadow-[0_6px_18px_rgb(0_0_0/0.45)] flex items-center justify-center cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold3 focus-visible:ring-offset-2 focus-visible:ring-offset-black2"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 text-brand-black shrink-0 -mr-0.5">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 text-brand-black shrink-0 -ml-0.5">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Drag hint */}
        <div
          className={`text-center mt-4 text-[10px] tracking-[0.22em] uppercase text-brand-white/40 transition-opacity duration-500 ${hasInteracted ? "opacity-0" : "opacity-100"}`}
          aria-hidden={hasInteracted}
        >
          ← {tBooking("beforeAfter.dragHint")} →
        </div>

        {/* Thumbnail strip */}
        <div className="mt-6 flex gap-3 lg:justify-center overflow-x-auto snap-x snap-mandatory -mx-4 px-4 lg:mx-0 lg:px-0 lg:overflow-visible">
          {TRANSFORMATIONS.map((_, i) => {
            const isActive = i === activeIdx;
            const thumbCaption = tBooking(`beforeAfter.transformations.${i}.caption`) as string;
            return (
              <button
                key={i}
                type="button"
                onClick={() => selectTransformation(i)}
                aria-label={thumbCaption}
                aria-pressed={isActive}
                className={`group flex-shrink-0 snap-start text-left bg-transparent border-0 p-0 cursor-pointer transition-[transform] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold3 focus-visible:ring-offset-2 focus-visible:ring-offset-black2 ${isActive ? "" : "hover:-translate-y-1"}`}
              >
                <div
                  className={`relative overflow-hidden rounded-[10px] w-[120px] aspect-[4/5] lg:w-[168px] lg:aspect-[16/10] border ${isActive ? "border-gold3" : "border-[rgb(254_251_243/0.1)]"} transition-[border-color] duration-300`}
                >
                  <img
                    src={TRANSFORMATIONS[i].after}
                    alt=""
                    className="w-full h-full object-cover"
                    loading={isActive ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                  />
                  {isActive && (
                    <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gold3 lg:hidden" />
                  )}
                </div>
                <div className={`mt-2 font-playfair text-[13px] text-center lg:text-left ${isActive ? "text-gold3" : "text-brand-white/50"} transition-colors duration-300`}>
                  {thumbCaption}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
