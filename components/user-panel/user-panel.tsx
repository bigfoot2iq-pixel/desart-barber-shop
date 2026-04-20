"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { SignInView } from "./sign-in-view";
import { AppointmentsView } from "./appointments-view";

interface UserPanelProps {
  onClose: () => void;
  showToast: (kind: "success" | "error", text: string) => void;
}

export function UserPanel({ onClose, showToast }: UserPanelProps) {
  const { user } = useAuth();

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
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0 border-b border-[rgb(10_8_0/11%)]">
          <div>
            <h3 className="text-[15px] font-bold text-brand-black tracking-[-0.01em]">
              {user ? "My Bookings" : "Account"}
            </h3>
            <p className="text-[11px] text-[rgb(10_8_0/45%)] mt-0.5">
              {user ? "Manage your appointments" : "Sign in to manage your bookings"}
            </p>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center border border-[rgb(10_8_0/20%)] cursor-pointer transition-[background,border-color] duration-200 hover:bg-[rgb(10_8_0/5%)] hover:border-[rgb(10_8_0/30%)]"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 10 10" width="10" height="10">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {user ? (
          <AppointmentsView onSignOut={onClose} showToast={showToast} />
        ) : (
          <SignInView onSignedIn={() => showToast("success", "Signed in successfully")} showToast={showToast} />
        )}
      </motion.div>
    </>
  );
}
