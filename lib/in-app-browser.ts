/**
 * In-app browser (embedded WebView) detection.
 *
 * Google OAuth refuses to run inside embedded WebViews — it returns
 * `403 disallowed_useragent`. Instagram / Facebook / TikTok / etc. all open
 * links in their own in-app WebView, so our Google sign-in silently dies there
 * (popups blocked AND the redirect flow rejected by Google).
 *
 * We detect these WebViews up-front and show the user a clean "open in your real
 * browser" notice instead of firing an OAuth flow that can never succeed.
 */

export type MobileOS = 'ios' | 'android' | 'other';

export interface InAppBrowserInfo {
  /** True when the page is running inside a known in-app WebView. */
  isInApp: boolean;
  /** Human-readable app brand name (e.g. "Instagram"), or null if generic/unknown. */
  appName: string | null;
  /** Detected mobile OS — drives which "escape" action we can offer. */
  os: MobileOS;
}

/** Named in-app browsers, matched against the user-agent (first match wins). */
const NAMED_APPS: Array<{ name: string; test: RegExp }> = [
  { name: 'Instagram', test: /Instagram/i },
  // Messenger must be checked before Facebook (its UA also contains FBAN).
  { name: 'Messenger', test: /Messenger|MessengerForiOS|FBAN\/Messenger/i },
  { name: 'Facebook', test: /FBAN|FBAV|FB_IAB|FBIOS|FB4A/i },
  { name: 'TikTok', test: /musical_ly|BytedanceWebview|TikTok|Trill/i },
  { name: 'Snapchat', test: /Snapchat/i },
  { name: 'LinkedIn', test: /LinkedInApp/i },
  { name: 'Pinterest', test: /Pinterest/i },
  { name: 'X', test: /Twitter/i },
  { name: 'WhatsApp', test: /WhatsApp/i },
  { name: 'Line', test: /\bLine\//i },
  { name: 'KakaoTalk', test: /KAKAOTALK/i },
];

function detectOS(ua: string): MobileOS {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/**
 * Inspect a user-agent string. Exported separately so it can be unit-tested
 * without a real `navigator`.
 */
export function parseUserAgent(ua: string): InAppBrowserInfo {
  const os = detectOS(ua);

  // 1. Known branded in-app browsers.
  for (const app of NAMED_APPS) {
    if (app.test.test(ua)) return { isInApp: true, appName: app.name, os };
  }

  // 2. Generic Android WebView — the `; wv` token is present in every WebView UA.
  if (os === 'android' && /;\s?wv\)/i.test(ua)) {
    return { isInApp: true, appName: null, os };
  }

  // 3. Generic iOS WebView heuristic. Real Safari always carries a "Safari"
  //    token; standalone browsers (Chrome=CriOS, Firefox=FxiOS, Edge=EdgiOS,
  //    Opera=OPiOS) carry their own. A WKWebView opened by a random app has an
  //    iOS UA with none of these — treat that as an in-app browser.
  if (os === 'ios') {
    const isRealBrowser = /Safari|CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    if (!isRealBrowser) return { isInApp: true, appName: null, os };
  }

  return { isInApp: false, appName: null, os };
}

/** Detect the current environment. Safe to call on the server (returns not-in-app). */
export function getInAppBrowser(): InAppBrowserInfo {
  if (typeof navigator === 'undefined') {
    return { isInApp: false, appName: null, os: 'other' };
  }
  return parseUserAgent(navigator.userAgent || '');
}

/**
 * Build an Android Chrome `intent://` URL that reopens the given https URL in
 * Chrome, breaking out of the current WebView. Android-only.
 */
export function buildChromeIntentUrl(url: string): string {
  const stripped = url.replace(/^https?:\/\//, '');
  return `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;end`;
}
