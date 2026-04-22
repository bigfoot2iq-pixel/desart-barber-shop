import 'server-only';
import type { Locale } from './config';

export type Namespace = 'common' | 'booking' | 'admin' | 'userPanel' | 'notifications' | 'dashboard' | 'staffNotifications';

type DictionaryLoader = () => Promise<Record<string, unknown>>;

type Loaders = {
  [K in Locale]: {
    [N in Namespace]: DictionaryLoader;
  };
};

const loaders: Loaders = {
  fr: {
    common: () => import('./dictionaries/fr/common.json').then(m => m.default as Record<string, unknown>),
    booking: () => import('./dictionaries/fr/booking.json').then(m => m.default as Record<string, unknown>),
    admin: () => import('./dictionaries/fr/admin.json').then(m => m.default as Record<string, unknown>),
    userPanel: () => import('./dictionaries/fr/userPanel.json').then(m => m.default as Record<string, unknown>),
    notifications: () => import('./dictionaries/fr/notifications.json').then(m => m.default as Record<string, unknown>),
    dashboard: () => import('./dictionaries/fr/dashboard.json').then(m => m.default as Record<string, unknown>),
    staffNotifications: () => import('./dictionaries/fr/staffNotifications.json').then(m => m.default as Record<string, unknown>),
  },
  en: {
    common: () => import('./dictionaries/en/common.json').then(m => m.default as Record<string, unknown>),
    booking: () => import('./dictionaries/en/booking.json').then(m => m.default as Record<string, unknown>),
    admin: () => import('./dictionaries/en/admin.json').then(m => m.default as Record<string, unknown>),
    userPanel: () => import('./dictionaries/en/userPanel.json').then(m => m.default as Record<string, unknown>),
    notifications: () => import('./dictionaries/en/notifications.json').then(m => m.default as Record<string, unknown>),
    dashboard: () => import('./dictionaries/en/dashboard.json').then(m => m.default as Record<string, unknown>),
    staffNotifications: () => import('./dictionaries/en/staffNotifications.json').then(m => m.default as Record<string, unknown>),
  },
};

export async function getDictionary<N extends Namespace>(
  locale: Locale,
  ns: N,
): Promise<Record<string, unknown>> {
  return loaders[locale][ns]();
}