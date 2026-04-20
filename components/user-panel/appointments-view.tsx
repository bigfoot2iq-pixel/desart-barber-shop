"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { AppointmentWithDetails, AppointmentReview } from "@/lib/types/database";
import { getCustomerAppointments, cancelAppointment } from "@/lib/queries/appointments";
import { createReview, getReviewsForAppointments } from "@/lib/queries/reviews";
import { AppointmentCard } from "./appointment-card";

interface AppointmentsViewProps {
  onSignOut: () => void;
  showToast: (kind: "success" | "error", text: string) => void;
}

export function AppointmentsView({ onSignOut, showToast }: AppointmentsViewProps) {
  const { user, signOut } = useAuth();
  const [items, setItems] = useState<AppointmentWithDetails[]>([]);
  const [reviews, setReviews] = useState<AppointmentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    getCustomerAppointments(user.id)
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        const ids = list.map((a) => a.id);
        if (ids.length > 0) {
          return getReviewsForAppointments(ids);
        }
        return [];
      })
      .then((reviewList) => {
        if (cancelled) return;
        setReviews(reviewList ?? []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const reviewIds = new Set(reviews.map((r) => r.appointment_id));

  const filtered = items.filter((item) => {
    if (tab === "upcoming") return item.status === "pending" || item.status === "confirmed";
    return item.status === "completed" || item.status === "cancelled";
  });

  const handleCancel = async (id: string) => {
    await cancelAppointment(id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "cancelled" as const } : item)));
    showToast("success", "Appointment cancelled");
  };

  const handleRate = async (appointmentId: string, professionalId: string | null, rating: number, comment: string | null) => {
    if (!user) return;
    await createReview({ appointment_id: appointmentId, customer_id: user.id, professional_id: professionalId, rating, comment });
    setReviews((prev) => [...prev, { id: crypto.randomUUID(), appointment_id: appointmentId, customer_id: user.id, professional_id: professionalId, rating, comment, created_at: new Date().toISOString() }]);
    showToast("success", "Thanks for rating!");
  };

  const handleSignOut = async () => {
    await signOut();
    onSignOut();
    showToast("success", "Signed out successfully");
  };

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const fullName = user?.user_metadata?.full_name as string | undefined;
  const email = user?.email ?? "";
  const initials = fullName
    ? fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 pt-4 pb-3 shrink-0 border-b border-[rgb(10_8_0/11%)]">
        <div className="flex items-center gap-3 mb-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,rgb(192_154_90/25%),rgb(192_154_90/12%))] flex items-center justify-center shrink-0">
              <span className="text-[11px] font-semibold text-[rgb(10_8_0/60%)] leading-none">{initials}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-black truncate">{fullName ?? "User"}</p>
            <p className="text-[11px] text-[rgb(10_8_0/40%)] truncate">{email}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.06em] transition-[background,border-color,color] duration-200 ${
                tab === t
                  ? "bg-gold text-white border border-gold"
                  : "bg-white text-[rgb(10_8_0/50%)] border border-[rgb(10_8_0/14%)] hover:border-[rgb(10_8_0/24%)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent]">
        {loading ? (
          <p className="text-[13px] text-[rgb(10_8_0/40%)] text-center py-8">Loading appointments…</p>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-[14px] text-[rgb(10_8_0/40%)]">No {tab} appointments</p>
          </div>
        ) : (
          filtered.map((item) => (
            <AppointmentCard
              key={item.id}
              item={item}
              hasReview={reviewIds.has(item.id)}
              onCancel={handleCancel}
              onRate={handleRate}
            />
          ))
        )}
      </div>

      <div className="px-5 pb-5 pt-3 shrink-0 border-t border-[rgb(10_8_0/11%)]">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full border-[1.5px] border-red-200 text-red-600 rounded-xl py-3 text-sm font-medium transition-[background,border-color] duration-200 hover:bg-red-50 hover:border-red-300"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
