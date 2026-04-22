import type { Locale } from './config';
import type { Service, Salon } from '@/lib/types/database';

export function localizeService(row: Service, locale: Locale): Service;
export function localizeService(row: Service | null, locale: Locale): Service | null;
export function localizeService(row: Service | null, locale: Locale): Service | null {
  if (!row || locale !== 'fr') return row;
  return {
    ...row,
    name: row.name_fr ?? row.name,
    description: row.description_fr ?? row.description,
  };
}

export function localizeSalon(row: Salon, locale: Locale): Salon;
export function localizeSalon(row: Salon | null, locale: Locale): Salon | null;
export function localizeSalon(row: Salon | null, locale: Locale): Salon | null {
  if (!row || locale !== 'fr') return row;
  return {
    ...row,
    name: row.name_fr ?? row.name,
    address: row.address_fr ?? row.address,
  };
}
