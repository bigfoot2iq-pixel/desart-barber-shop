"use client";

import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import type { AppointmentWithDetails } from "@/lib/types/database";
import { RateDialog } from "./rate-dialog";
import { useT } from "@/lib/i18n/client-dictionary";
import { formatShortMonth } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

function formatDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${formatShortMonth(new Date(y, m - 1, d), locale)} ${y}`;
}

const STATUS_CHIP_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  confirmed: "bg-[rgb(192_154_90/12%)] text-[rgb(140_110_50)] border border-[rgb(192_154_90/30%)]",
  completed: "bg-green-50 text-green-700 border border-green-200",
  cancelled: "bg-[rgb(10_8_0/5%)] text-[rgb(10_8_0/40%)] border border-[rgb(10_8_0/10%)]",
};

interface AppointmentCardProps {
  item: AppointmentWithDetails;
  hasReview: boolean;
  onCancel: (id: string) => void;
  onRate: (appointmentId: string, professionalId: string | null, rating: number, comment: string | null) => void;
  locale: string;
}

export function AppointmentCard({ item, hasReview, onCancel, onRate, locale }: AppointmentCardProps) {
  const tUser = useT('userPanel');
  const tCommon = useT('common');
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [optimisticallyCancelled, setOptimisticallyCancelled] = useState(false);

  const status = optimisticallyCancelled ? "cancelled" : item.status;
  const professional = item.professional || item.preferred_professional;
  const professionalName = professional?.display_name ?? tUser('card.unassigned');
  const salonName = item.location_type === "home" ? tUser('card.homeVisit') : (item.salon?.name ?? tUser('card.salonFallback'));
  const serviceNames = item.services.map((s) => s.name).join(", ");
  const dateStr = item.appointment_date;
  const timeStr = item.start_time?.slice(0, 5) ?? "";

  const handleCancel = async () => {
    setOptimisticallyCancelled(true);
    try {
      await onCancel(item.id);
    } catch {
      setOptimisticallyCancelled(false);
    }
  };

  const handleRateSubmit = (rating: number, comment: string | null) => {
    onRate(item.id, professional?.id ?? null, rating, comment);
    setShowRateDialog(false);
  };

  return (
    <>
      <div className="rounded-2xl border-[1.5px] border-[rgb(10_8_0/14%)] bg-white px-[18px] py-4 flex flex-col gap-2 shadow-[0_1px_2px_rgb(0_0_0/3%)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-brand-black leading-snug truncate">{serviceNames}</p>
          <div className="flex items-center gap-2 shrink-0">
            {(status === "completed" || status === "cancelled") && (
              <span className={`text-[10px] font-semibold uppercase tracking-[0.06em] px-2.5 py-1 rounded-full ${STATUS_CHIP_STYLES[status] ?? ""}`}>
                {tUser(`status.${status}`)}
              </span>
            )}
            {status === "pending" && (
              <button
                type="button"
                onClick={handleCancel}
                className="text-[11px] font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 transition-[background,border-color] duration-200 hover:bg-red-50 hover:border-red-300"
              >
                {tCommon('cancel')}
              </button>
            )}
            {status === "completed" && !hasReview && (
              <button
                type="button"
                onClick={() => setShowRateDialog(true)}
                className="text-[11px] font-semibold text-white bg-gold rounded-full px-3 py-1.5 transition-[background,box-shadow] duration-200 hover:shadow-[0_2px_8px_rgb(192_154_90/30%)]"
              >
                {tUser('card.rate')}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-[rgb(10_8_0/50%)] truncate">{professionalName} · {salonName}</p>
          <p className="text-[11px] text-[rgb(10_8_0/35%)] shrink-0">{formatDate(dateStr, locale as Locale)} · {timeStr}</p>
        </div>
      </div>

      <AnimatePresence>
        {showRateDialog && (
          <RateDialog
            onClose={() => setShowRateDialog(false)}
            onSubmit={handleRateSubmit}
          />
        )}
      </AnimatePresence>
    </>
  );
}
