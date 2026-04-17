'use client';

interface BadgeProps {
  variant: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'active' | 'inactive' | 'default';
  children: React.ReactNode;
}

const variantStyles: Record<BadgeProps['variant'], string> = {
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  confirmed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  completed: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/40',
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  inactive: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
  default: 'bg-admin-surface border-gold/25 text-cream',
};

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantStyles[variant]}`}>
      {children}
    </span>
  );
}