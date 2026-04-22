import 'server-only';
import type { Locale } from './config';

export type Namespace = 'common' | 'booking' | 'admin' | 'userPanel' | 'notifications' | 'dashboard' | 'staffNotifications';

type DictionaryLoader = () => Promise<Record<string, unknown>>;

type Loaders = {
  [K in Locale]: {
    [N in Namespace]: DictionaryLoader;
  };
};

function resolveModule<T>(m: unknown): T {
  if (m && typeof m === 'object' && 'default' in m) {
    return (m as { default: T }).default;
  }
  return m as T;
}

const loaders: Loaders = {
  fr: {
    common: () => import('./dictionaries/fr/common.json').then(resolveModule<Record<string, unknown>>),
    booking: () => import('./dictionaries/fr/booking.json').then(resolveModule<Record<string, unknown>>),
    admin: () => import('./dictionaries/fr/admin.json').then(resolveModule<Record<string, unknown>>),
    userPanel: () => import('./dictionaries/fr/userPanel.json').then(resolveModule<Record<string, unknown>>),
    notifications: () => import('./dictionaries/fr/notifications.json').then(resolveModule<Record<string, unknown>>),
    dashboard: () => import('./dictionaries/fr/dashboard.json').then(resolveModule<Record<string, unknown>>),
    staffNotifications: () => import('./dictionaries/fr/staffNotifications.json').then(resolveModule<Record<string, unknown>>),
  },
  en: {
    common: () => import('./dictionaries/en/common.json').then(resolveModule<Record<string, unknown>>),
    booking: () => import('./dictionaries/en/booking.json').then(resolveModule<Record<string, unknown>>),
    admin: () => import('./dictionaries/en/admin.json').then(resolveModule<Record<string, unknown>>),
    userPanel: () => import('./dictionaries/en/userPanel.json').then(resolveModule<Record<string, unknown>>),
    notifications: () => import('./dictionaries/en/notifications.json').then(resolveModule<Record<string, unknown>>),
    dashboard: () => import('./dictionaries/en/dashboard.json').then(resolveModule<Record<string, unknown>>),
    staffNotifications: () => import('./dictionaries/en/staffNotifications.json').then(resolveModule<Record<string, unknown>>),
  },
};

export async function getDictionary<N extends Namespace>(
  locale: Locale,
  ns: N,
): Promise<Record<string, unknown>> {
  return loaders[locale][ns]();
}