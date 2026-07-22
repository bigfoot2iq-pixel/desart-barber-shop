"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client-dictionary";
import { buildChromeIntentUrl, type MobileOS } from "@/lib/in-app-browser";

interface InAppBrowserNoticeProps {
  /** Brand name of the detected app (e.g. "Instagram"), or null if generic. */
  appName: string | null;
  os: MobileOS;
  /** Light for the user panel (cream bg), dark for the login page. */
  variant?: "light" | "dark";
}

export function InAppBrowserNotice({ appName, os, variant = "light" }: InAppBrowserNoticeProps) {
  const t = useT("common");
  const [copied, setCopied] = useState(false);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
    } catch {
      // Clipboard API unavailable in some WebViews — fall back to a temp input.
      const input = document.createElement("input");
      input.value = pageUrl;
      document.body.appendChild(input);
      input.select();
      try { document.execCommand("copy"); } catch { /* ignored */ }
      document.body.removeChild(input);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const dark = variant === "dark";
  const body = appName
    ? t("inAppBrowser.bodyNamed", { app: appName })
    : t("inAppBrowser.bodyGeneric");
  const instructions =
    os === "ios" ? t("inAppBrowser.iosInstructions") : t("inAppBrowser.androidInstructions");

  return (
    <div
      className={[
        "flex flex-col items-center text-center rounded-2xl p-6 gap-4",
        dark
          ? "bg-[rgb(254_251_243/4)] border border-[rgb(254_251_243/12)]"
          : "bg-white border border-[rgb(10_8_0/12%)] shadow-[0_2px_12px_rgb(0_0_0/4%)]",
      ].join(" ")}
    >
      {/* Browser-with-arrow icon */}
      <div
        className={[
          "w-14 h-14 rounded-full flex items-center justify-center shrink-0",
          dark ? "bg-gold3/15 text-gold3" : "bg-[rgb(192_154_90/12%)] text-[#b8935a]",
        ].join(" ")}
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M3 9h18" />
          <path d="M10 21h4M12 18v3" />
          <path d="M14 13l3-3-3-3M17 10H9" />
        </svg>
      </div>

      <h3 className={dark ? "font-playfair text-[20px] font-medium text-brand-white" : "font-playfair text-[20px] font-medium text-brand-black"}>
        {t("inAppBrowser.heading")}
      </h3>

      <p className={["text-[13px] leading-[1.7] max-w-[300px]", dark ? "text-[rgb(254_251_243/60)]" : "text-[rgb(10_8_0/60%)]"].join(" ")}>
        {body}
      </p>

      <div className="w-full flex flex-col gap-2.5 mt-1">
        {/* Android: hard escape into Chrome. */}
        {os === "android" && pageUrl && (
          <a
            href={buildChromeIntentUrl(pageUrl)}
            className={[
              "w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors duration-200",
              dark
                ? "bg-gold3 text-brand-black hover:bg-gold4"
                : "bg-[#b8935a] text-white hover:bg-[#a07f48]",
            ].join(" ")}
          >
            {t("inAppBrowser.openChrome")}
          </a>
        )}

        {/* Everyone: copy the link to paste into a real browser. */}
        <button
          type="button"
          onClick={handleCopy}
          className={[
            "w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors duration-200 border",
            dark
              ? "border-[rgb(254_251_243/20)] text-brand-white hover:bg-[rgb(254_251_243/6)]"
              : "border-[rgb(10_8_0/16%)] text-brand-black hover:bg-[rgb(10_8_0/4%)]",
          ].join(" ")}
        >
          {copied ? t("inAppBrowser.copied") : t("inAppBrowser.copyLink")}
        </button>
      </div>

      <p className={["text-[11px] leading-[1.6] max-w-[280px]", dark ? "text-[rgb(254_251_243/35)]" : "text-[rgb(10_8_0/40%)]"].join(" ")}>
        {instructions}
      </p>
    </div>
  );
}
