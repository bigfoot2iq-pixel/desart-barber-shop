"use client";

import { useState } from "react";
import type { AppointmentWithDetails } from "@/lib/types/database";
import { useT } from "@/lib/i18n/client-dictionary";
import { formatShortMonth } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

function formatDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${formatShortMonth(new Date(y, m - 1, d), locale)} ${y}`;
}

interface RateViewProps {
  item: AppointmentWithDetails;
  locale: string;
  onSubmit: (rating: number, comment: string | null) => Promise<void>;
}

export function RateView({ item, locale, onSubmit }: RateViewProps) {
  const tUser = useT('userPanel');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const professional = item.professional || item.preferred_professional;
  const professionalName = professional?.display_name ?? tUser('card.unassigned');
  const salonName = item.location_type === "home"
    ? tUser('card.homeVisit')
    : (item.salon?.name ?? tUser('card.salonFallback'));
  const serviceNames = item.services.map((s) => s.name).join(", ");
  const dateStr = `${formatDate(item.appointment_date, locale as Locale)} · ${item.start_time?.slice(0, 5) ?? ""}`;

  const handleSubmit = async () => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(rating, comment.trim() || null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#fafaf8]">
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6 [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent]">
        <p className="text-[12px] text-[rgb(10_8_0/45%)] text-center">
          {tUser('rateDialog.subtitle')}
        </p>

        <div className="rounded-2xl bg-white border-[1.5px] border-[rgb(10_8_0/10%)] px-4 py-3 mt-4 mb-7">
          <p className="text-[13px] font-semibold text-brand-black truncate">{serviceNames}</p>
          <p className="text-[11px] text-[rgb(10_8_0/50%)] truncate mt-0.5">{professionalName} · {salonName}</p>
          <p className="text-[11px] text-[rgb(10_8_0/35%)] mt-0.5">{dateStr}</p>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5 cursor-pointer bg-none border-none"
              aria-label={tUser('rateDialog.starAria', { count: star })}
            >
              <svg
                viewBox="0 0 24 24"
                width="44"
                height="44"
                className={`transition-colors duration-150 ${
                  star <= (hoverRating || rating)
                    ? "fill-gold text-gold"
                    : "fill-none text-[rgb(10_8_0/15%)]"
                }`}
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={tUser('rateDialog.placeholder')}
          rows={4}
          className="w-full bg-white border-[1.5px] border-[rgb(10_8_0/14%)] rounded-xl px-4 py-3 text-sm text-brand-black outline-none transition-[border-color] duration-200 placeholder:text-[rgb(10_8_0/25%)] focus:border-gold resize-none [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent]"
        />
      </div>

      <div className="px-5 pb-5 pt-3 shrink-0 border-t border-[rgb(10_8_0/11%)]">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full bg-brand-black text-white rounded-xl py-3 text-sm font-semibold transition-[background,opacity] duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink"
        >
          {submitting ? tUser('rateDialog.submitting') : tUser('rateDialog.submit')}
        </button>
      </div>
    </div>
  );
}
