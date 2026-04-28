"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/client-dictionary";
import type { AppointmentWithDetails } from "@/lib/types/database";
import { SignInView } from "./sign-in-view";
import { AppointmentsView } from "./appointments-view";

interface UserPanelProps {
  onClose: () => void;
  showToast: (kind: "success" | "error", text: string) => void;
  locale: string;
}

export function UserPanel({ onClose, showToast, locale }: UserPanelProps) {
  const { user } = useAuth();
  const tUser = useT('userPanel');
  const tCommon = useT('common');
  const [rateTarget, setRateTarget] = useState<AppointmentWithDetails | null>(null);

  const inRate = !!rateTarget;

  return (
    <>
      <motion.div
        className="absolute inset-0 bg-[rgb(10_8_0/40%)] [backdrop-filter:blur(3px)] z-[9]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 h-3/4 bg-[#fafaf8] rounded-t-[20px] z-10 flex flex-col overflow-hidden shadow-[0_-12px_40px_rgb(0_0_0/18%)] max-sm:w-full"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 250 }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0 border-b border-[rgb(10_8_0/11%)] gap-3">
          {inRate ? (
            <>
              <button
                type="button"
                className="w-8 h-8 -ml-1 flex items-center justify-center rounded-full text-brand-black cursor-pointer transition-[background] duration-200 hover:bg-[rgb(10_8_0/5%)]"
                onClick={() => setRateTarget(null)}
                aria-label={tCommon('back')}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <h3 className="flex-1 text-center text-[15px] font-bold text-brand-black tracking-[-0.01em]">
                {tUser('rateDialog.title')}
              </h3>
              <div className="w-8 h-8 shrink-0" aria-hidden="true" />
            </>
          ) : (
            <>
              <div>
                <h3 className="text-[15px] font-bold text-brand-black tracking-[-0.01em]">
                  {user ? tUser('panel.myBookings') : tUser('panel.account')}
                </h3>
                <p className="text-[11px] text-[rgb(10_8_0/45%)] mt-0.5">
                  {user ? tUser('panel.manageAppointments') : tUser('panel.signInToManage')}
                </p>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-full flex items-center justify-center border border-[rgb(10_8_0/20%)] cursor-pointer transition-[background,border-color] duration-200 hover:bg-[rgb(10_8_0/5%)] hover:border-[rgb(10_8_0/30%)]"
                onClick={onClose}
                aria-label={tCommon('close')}
              >
                <svg viewBox="0 0 10 10" width="10" height="10">
                  <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              </button>
            </>
          )}
        </div>

        {user ? (
          <AppointmentsView
            onSignOut={onClose}
            showToast={showToast}
            locale={locale}
            rateTarget={rateTarget}
            onRequestRate={setRateTarget}
          />
        ) : (
          <SignInView onSignedIn={() => showToast("success", tUser('toast.signedIn'))} showToast={showToast} />
        )}
      </motion.div>
    </>
  );
}
