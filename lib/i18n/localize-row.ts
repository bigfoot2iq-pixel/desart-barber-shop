import type { Locale } from './config';
import type { Service, Salon } from '@/lib/types/database';

export function localizeService(row: Service, locale: Locale): Service {
  if (locale !== 'fr') return row;
  return {
    ...row,
    name: row.name_fr ?? row.name,
    description: row.description_fr ?? row.description,
  };
}

export function localizeSalon(row: Salon, locale: Locale): Salon {
  if (locale !== 'fr') return row;
  return {
    ...row,
    name: row.name_fr ?? row.name,
    address: row.address_fr ?? row.address,
  };
}
