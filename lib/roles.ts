import { type User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'professional' | 'customer';

export function getRole(user: User | null): UserRole | null {
  if (!user) return null;
  return (user.app_metadata?.role as UserRole) ?? null;
}

export function hasRole(user: User | null, role: UserRole): boolean {
  return getRole(user) === role;
}

export function hasAnyRole(user: User | null, roles: UserRole[]): boolean {
  const userRole = getRole(user);
  return userRole !== null && roles.includes(userRole);
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['manage_all', 'view_analytics', 'manage_users', 'manage_bookings', 'manage_barbers', 'manage_services'],
  professional: ['view_own_bookings', 'manage_own_schedule', 'update_profile'],
  customer: ['create_booking', 'view_own_bookings', 'update_profile'],
};

export function canPerformAction(user: User | null, action: string): boolean {
  const role = getRole(user);
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(action);
}
