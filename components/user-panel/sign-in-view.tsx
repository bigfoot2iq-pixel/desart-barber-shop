"use client";

import { useAuth } from "@/lib/auth-context";

interface SignInViewProps {
  onSignedIn: () => void;
  showToast: (kind: "success" | "error", text: string) => void;
}

export function SignInView({ onSignedIn, showToast }: SignInViewProps) {
  const { signInWithGoogleModal } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogleModal();
      onSignedIn();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 flex flex-col items-center [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent]">
      <div className="w-[72px] h-[72px] rounded-full bg-[linear-gradient(135deg,#c09a5a,#d4ae70)] flex items-center justify-center mb-6 shadow-[0_8px_24px_rgb(192_154_90/30%),0_4px_10px_rgb(0_0_0/8%)]">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>

      <h2 className="font-playfair text-[28px] font-medium text-brand-black mb-2 tracking-[-0.02em]">Sign in</h2>
      <p className="text-[13px] text-[rgb(10_8_0/50%)] leading-[1.7] text-center mb-8 max-w-[260px]">
        Use your Google account to manage your bookings
      </p>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full bg-white border-[1.5px] border-[rgb(10_8_0/14%)] rounded-xl px-4 py-3.5 flex items-center justify-center gap-3 text-sm font-semibold text-brand-black shadow-[0_1px_2px_rgb(0_0_0/3%)] transition-[border-color,background,box-shadow] duration-200 hover:border-[rgb(10_8_0/24%)] hover:bg-[rgb(10_8_0/3%)] hover:shadow-[0_2px_8px_rgb(0_0_0/5%)]"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" className="shrink-0">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>

      <p className="text-[11px] text-[rgb(10_8_0/35%)] text-center mt-6 leading-[1.6] max-w-[240px]">
        By continuing, you agree to our use of cookies for authentication and session management.
      </p>
    </div>
  );
}
