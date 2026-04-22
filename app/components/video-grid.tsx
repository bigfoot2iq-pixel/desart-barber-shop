"use client";

import { useRef, useState } from "react";

export const HERO_VIDEOS = [
  "https://ftqpkwbbrnvwpgcxiuli.supabase.co/storage/v1/object/public/desart-barber-shop/hero-1.mp4",
  "https://ftqpkwbbrnvwpgcxiuli.supabase.co/storage/v1/object/public/desart-barber-shop/hero-2.mp4",
  "https://ftqpkwbbrnvwpgcxiuli.supabase.co/storage/v1/object/public/desart-barber-shop/hero-3.mp4",
  "https://ftqpkwbbrnvwpgcxiuli.supabase.co/storage/v1/object/public/desart-barber-shop/hero-4.mp4",
  "https://ftqpkwbbrnvwpgcxiuli.supabase.co/storage/v1/object/public/desart-barber-shop/hero-5.mp4",
  "https://ftqpkwbbrnvwpgcxiuli.supabase.co/storage/v1/object/public/desart-barber-shop/hero-6.mp4",
  "https://ftqpkwbbrnvwpgcxiuli.supabase.co/storage/v1/object/public/desart-barber-shop/hero-7.mp4",
  "https://ftqpkwbbrnvwpgcxiuli.supabase.co/storage/v1/object/public/desart-barber-shop/hero-8.mp4",
  "https://ftqpkwbbrnvwpgcxiuli.supabase.co/storage/v1/object/public/desart-barber-shop/hero-9.mp4",
];

export const VIDEO_META: {
  src: string;
  title: string;
  style: string;
  likes: string;
  views: string;
}[] = [
  {
    src: HERO_VIDEOS[0],
    title: "The Classic Cut — Where Tradition Meets Modern Elegance",
    style: "Timeless Precision",
    likes: "2.4K",
    views: "12.8K",
  },
  {
    src: HERO_VIDEOS[1],
    title: "Skin Fade Mastery — Clean Lines, Bold Statements",
    style: "Sharp & Refined",
    likes: "3.1K",
    views: "18.2K",
  },
  {
    src: HERO_VIDEOS[2],
    title: "Beard Sculpting — Artistry in Every Detail",
    style: "Precision Crafted",
    likes: "1.9K",
    views: "9.5K",
  },
  {
    src: HERO_VIDEOS[3],
    title: "Hot Towel Ritual — The Ultimate Grooming Experience",
    style: "Pure Luxury",
    likes: "2.7K",
    views: "15.3K",
  },
  {
    src: HERO_VIDEOS[4],
    title: "Textured Flow — Effortless Style, Expert Execution",
    style: "Modern Edge",
    likes: "2.1K",
    views: "11.4K",
  },
  {
    src: HERO_VIDEOS[5],
    title: "Straight Razor Finish — Old School, New Standard",
    style: "Heritage Craft",
    likes: "1.6K",
    views: "8.7K",
  },
  {
    src: HERO_VIDEOS[6],
    title: "The Full Transformation — From Rough to Refined",
    style: "Complete Makeover",
    likes: "3.8K",
    views: "22.1K",
  },
  {
    src: HERO_VIDEOS[7],
    title: "Signature Styling — Your Look, Elevated",
    style: "Bespoke Grooming",
    likes: "2.9K",
    views: "16.5K",
  },
  {
    src: HERO_VIDEOS[8],
    title: "The Master's Touch — Where Art Meets Craft",
    style: "Elite Grooming",
    likes: "3.4K",
    views: "19.8K",
  },
];

export function getVideoMeta(src: string) {
  return (
    VIDEO_META.find((m) => m.src === src) || {
      title: "",
      style: "",
      likes: "",
      views: "",
    }
  );
}

export function VideoCell({ src, index }: { src: string; index: number }) {
  const meta = getVideoMeta(src);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group relative overflow-hidden bg-brand-black shrink-0 aspect-[9/14]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        className="w-full h-full object-cover block [filter:brightness(0.65)_contrast(1.1)_saturate(1.1)] transition-[filter,transform] duration-500 ease-out group-hover:[filter:brightness(0.75)_contrast(1.05)_saturate(1.15)] group-hover:scale-105"
      >
        <source src={src} type="video/mp4" />
      </video>
      <span className="absolute top-2 left-2 lg:top-2.5 lg:left-2.5 inline-flex items-center gap-1 px-2 py-1 lg:px-2.5 lg:py-1 bg-[rgb(0_0_0/0.75)] border border-[rgb(212_175_55/0.5)] text-[#fefbe3] text-[8px] lg:text-[9px] font-semibold tracking-[0.1em] uppercase [backdrop-filter:blur(8px)] z-[2] pointer-events-none shadow-[0_2px_8px_rgb(0_0_0/0.4)] before:content-[''] before:w-1 before:h-1 lg:before:w-1.5 lg:before:h-1.5 before:rounded-full before:bg-gold3 before:shrink-0">
        {meta.style}
      </span>
      <div className={`absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-b from-[rgb(10_8_0/0)] from-40% to-[rgb(10_8_0/0.85)] transition-opacity duration-350 ease-out pointer-events-none ${isHovered ? "opacity-100" : "opacity-0"}`}>
        <div className="flex justify-start items-end">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-[rgb(254_251_243/0.95)] tracking-[0.02em]">
              {meta.title}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileVideoCarousel() {
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
      setActiveIndex(
        (prev) => (prev + (delta < 0 ? 1 : -1) + count) % count
      );
    }
    touchStartX.current = null;
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        className="absolute w-0 h-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        {videos.map((src) => (
          <video key={src} preload="auto" src={src} muted />
        ))}
      </div>

      {/* Cards */}
      <div
        className="flex items-center justify-center gap-2 w-full [touch-action:pan-y] px-3"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative shrink-0 rounded-xl overflow-hidden bg-[#151515] w-[28%] aspect-[9/13] transition-[opacity,transform] duration-300 opacity-40 scale-[0.96]">
          <video autoPlay muted loop playsInline
            className="w-full h-full object-cover block"
            src={leftVideo}
          />
        </div>

        <div className="relative shrink-0 rounded-xl overflow-hidden bg-[#151515] w-[58%] aspect-[9/14] transition-[transform] duration-300 scale-100">
          <video autoPlay muted loop playsInline
            className="w-full h-full object-cover block"
            src={centerVideo}
          />
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[rgb(0_0_0/0.7)] border border-[rgb(212_175_55/0.4)] text-[#fefbe3] text-[9px] max-sm:text-[7px] font-semibold tracking-[0.1em] uppercase [backdrop-filter:blur(6px)] z-[2] pointer-events-none before:content-[''] before:w-[5px] before:h-[5px] before:rounded-full before:bg-gold3 before:shrink-0">
            {getVideoMeta(centerVideo).style}
          </span>
          {/* Bottom title on center card */}
          <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8 bg-gradient-to-t from-[rgb(10_8_0/0.85)] to-transparent pointer-events-none">
            <span className="text-[11px] font-light text-brand-white/70 leading-snug line-clamp-2">
              {getVideoMeta(centerVideo).title}
            </span>
          </div>
        </div>

        <div className="relative shrink-0 rounded-xl overflow-hidden bg-[#151515] w-[28%] aspect-[9/13] transition-[opacity,transform] duration-300 opacity-40 scale-[0.96]">
          <video autoPlay muted loop playsInline
            className="w-full h-full object-cover block"
            src={rightVideo}
          />
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center gap-1.5">
        {videos.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to video ${i + 1}`}
            onClick={() => setActiveIndex(i)}
            className={`h-1 rounded-full transition-[width,background-color] duration-300 ${
              i === activeIndex ? "w-5 bg-gold3" : "w-1 bg-brand-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function DesktopVideoGrid() {
  return (
    <div className="grid grid-cols-3 gap-1 h-full">
      <div className="group overflow-hidden relative h-full">
        <div className="flex flex-col gap-1 will-change-transform animate-vg-scroll-down group-hover:[animation-play-state:paused]">
          {[
            HERO_VIDEOS[0],
            HERO_VIDEOS[1],
            HERO_VIDEOS[2],
            HERO_VIDEOS[0],
            HERO_VIDEOS[1],
            HERO_VIDEOS[2],
          ].map((src, i) => (
            <VideoCell key={`c1-${i}`} src={src} index={i} />
          ))}
        </div>
      </div>
      <div className="group overflow-hidden relative h-full">
        <div className="flex flex-col gap-1 will-change-transform animate-vg-scroll-up group-hover:[animation-play-state:paused]">
          {[
            HERO_VIDEOS[3],
            HERO_VIDEOS[4],
            HERO_VIDEOS[5],
            HERO_VIDEOS[3],
            HERO_VIDEOS[4],
            HERO_VIDEOS[5],
          ].map((src, i) => (
            <VideoCell key={`c2-${i}`} src={src} index={i} />
          ))}
        </div>
      </div>
      <div className="group overflow-hidden relative h-full">
        <div className="flex flex-col gap-1 will-change-transform animate-vg-scroll-down group-hover:[animation-play-state:paused]">
          {[
            HERO_VIDEOS[6],
            HERO_VIDEOS[7],
            HERO_VIDEOS[8],
            HERO_VIDEOS[6],
            HERO_VIDEOS[7],
            HERO_VIDEOS[8],
          ].map((src, i) => (
            <VideoCell key={`c3-${i}`} src={src} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}