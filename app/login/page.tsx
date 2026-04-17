'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { DesktopVideoGrid } from '@/app/components/video-grid';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setError('Failed to sign in with Google. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh lg:h-svh lg:overflow-hidden bg-brand-black flex flex-col lg:flex-row">
      {/* Login Panel */}
      <div className="relative z-10 flex flex-col justify-center items-center w-full min-h-svh px-6 py-16 lg:w-[46%] lg:min-h-0 lg:px-0 lg:py-0">
        <div className="w-full max-w-[400px]">
          {/* Brand Mark */}
          <div className="mb-12 lg:mb-14">
            <div className="flex items-center gap-2.5 font-playfair text-2xl font-bold tracking-[0.14em] text-gold3 mb-3">
              <img src="/logo.jpg" alt="Desart" className="w-8 h-8 rounded-full object-cover shrink-0" />
              DESART
            </div>
            <div className="w-12 h-px bg-gold3/50" />
          </div>

          {/* Heading */}
          <h1 className="font-playfair text-[28px] lg:text-[32px] font-normal text-brand-white tracking-[-0.01em] leading-[1.15] mb-2">
            Welcome back
          </h1>
          <p className="text-[15px] font-light text-[rgb(254_251_243/50)] leading-[1.65] tracking-[0.01em] mb-10">
            Sign in to your account to continue booking premium grooming services.
          </p>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="group w-full flex items-center justify-center gap-3 bg-[rgb(254_251_243)] hover:bg-white text-brand-black font-medium text-[15px] py-3.5 px-5 rounded-lg transition-all duration-200 border border-[rgb(254_251_243/15)] hover:border-[rgb(254_251_243/30)] hover:shadow-[0_0_24px_rgb(212_175_55/0.15)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-brand-black/30 border-t-brand-black rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Continue with Google
          </button>

          {/* Error State */}
          {error && (
            <div className="mt-5 flex items-center gap-2.5 text-[13px] text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg px-4 py-3">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-[rgb(254_251_243/8)]" />
            <span className="text-[11px] tracking-[0.12em] uppercase text-[rgb(254_251_243/25)]">or</span>
            <div className="flex-1 h-px bg-[rgb(254_251_243/8)]" />
          </div>

          {/* Helper Link */}
          <p className="text-[13px] text-[rgb(254_251_243/40)] leading-[1.65]">
            New to DESART?{' '}
            <button
              onClick={handleGoogleSignIn}
              className="text-gold3 hover:text-gold4 transition-colors duration-200 underline underline-offset-2 decoration-gold3/30 hover:decoration-gold4/50"
            >
              Create an account
            </button>
          </p>

          {/* Terms */}
          <p className="text-[11px] text-[rgb(254_251_243/20)] leading-[1.6] mt-6">
            By continuing, you agree to DESART&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>

        {/* Back to Home */}
        <button
          onClick={() => router.push('/')}
          className="absolute top-6 left-6 flex items-center gap-2 text-[12px] tracking-[0.06em] text-[rgb(254_251_243/30)] hover:text-gold3 transition-colors duration-200 group"
        >
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to home
        </button>
      </div>

      {/* Video Grid — Desktop Only */}
      <div className="hidden lg:block lg:flex-1 lg:relative lg:h-full lg:overflow-visible">
        <DesktopVideoGrid />
        <div className="absolute left-0 right-0 h-[100px] z-[3] pointer-events-none top-0 bg-gradient-to-b from-brand-black to-transparent" />
        <div className="absolute left-0 right-0 h-[100px] z-[3] pointer-events-none bottom-0 bg-gradient-to-t from-brand-black to-transparent" />
        {/* Left edge fade into login panel */}
        <div className="absolute top-0 bottom-0 w-[80px] z-[2] pointer-events-none left-0 bg-gradient-to-r from-brand-black to-transparent" />
      </div>
    </div>
  );
}