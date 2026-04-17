'use client';

import { motion } from 'framer-motion';

interface Stat {
  label: string;
  value: number | string;
  icon: string;
  color: string;
}

interface StatsCardsProps {
  stats: Stat[];
  loading?: boolean;
}

export default function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="admin-card p-6 animate-pulse">
            <div className="h-3 bg-gold/10 rounded w-2/3 mb-4" />
            <div className="h-8 bg-gold/8 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.35 }}
          className="admin-card p-5 relative overflow-hidden"
        >
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${stat.color.replace('bg-', 'bg-').replace('/20', '/80')}`} />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-cream/55 uppercase tracking-wider font-semibold">{stat.label}</span>
            <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-playfair font-bold text-cream">{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
}