'use client';

import { useEffect } from 'react';

export default function PopupCallbackPage() {
  useEffect(() => {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'desart:auth:success' }, window.location.origin);
      }
    } catch {
      // cross-origin or no opener — fall through and close anyway
    }
    const t = window.setTimeout(() => {
      try { window.close(); } catch { /* ignored */ }
    }, 50);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-svh flex items-center justify-center bg-brand-black text-brand-white font-dm-sans text-sm">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-gold3/30 border-t-gold3 rounded-full animate-spin mx-auto mb-3" />
        Signing you in…
      </div>
    </div>
  );
}
