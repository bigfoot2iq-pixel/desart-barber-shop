'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type BadgeVariant = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'active' | 'inactive' | 'default';

interface AdminBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  pending: 'bg-white/10 text-neutral-300 border-white/20',
  confirmed: 'bg-neutral-400/15 text-neutral-300 border-neutral-400/30',
  completed: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/40',
  active: 'bg-neutral-400/15 text-neutral-300 border-neutral-400/30',
  inactive: 'bg-neutral-600/15 text-neutral-500 border-neutral-600/30',
  default: '',
};

export function AdminBadge({ variant, children }: AdminBadgeProps) {
  if (variant === 'default') {
    return <Badge variant="secondary">{children}</Badge>;
  }
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
      variantStyles[variant]
    )}>
      {children}
    </span>
  );
}