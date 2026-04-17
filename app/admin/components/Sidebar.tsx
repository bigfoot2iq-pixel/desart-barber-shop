'use client';

import { motion, AnimatePresence } from 'framer-motion';

export type Section = 'dashboard' | 'appointments' | 'professionals' | 'services' | 'salons';

interface SidebarProps {
  active: Section;
  onChange: (section: Section) => void;
  pendingCount: number;
  adminName: string;
  adminEmail: string;
  onSignOut: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems: { key: Section; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { key: 'appointments', label: 'Appointments', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { key: 'professionals', label: 'Professionals', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { key: 'services', label: 'Services', icon: 'M14.121 14.121L19 19m-4.879-4.879l-2.652 2.652a3 3 0 01-4.243 0l-.59-.59a3 3 0 010-4.243l2.652-2.652m4.833 4.833L9.9 9.9m4.833 4.833l2.652-2.652a3 3 0 000-4.243l-.59-.59a3 3 0 00-4.243 0l-2.652 2.652' },
  { key: 'salons', label: 'Salons', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
];

export default function Sidebar({ active, onChange, pendingCount, adminName, adminEmail, onSignOut, mobileOpen, onMobileClose }: SidebarProps) {
  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 border-b border-gold/15">
        <h1 className="font-playfair text-2xl text-cream tracking-wider font-bold">DESART</h1>
        <p className="text-xs text-cream/45 mt-1 uppercase tracking-[0.2em] font-medium">Admin Panel</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => { onChange(item.key); onMobileClose(); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              active === item.key
                ? 'bg-gold/15 text-gold3 border-l-2 border-gold3 rounded-l-none rounded-r-lg'
                : 'text-cream/55 hover:text-cream hover:bg-cream/5'
            }`}
          >
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            <span>{item.label}</span>
            {item.key === 'appointments' && pendingCount > 0 && (
              <span className="ml-auto bg-amber-500 text-brand-black text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gold/15">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center text-gold3 font-playfair text-sm font-bold ring-1 ring-gold/25">
            {adminName?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-cream font-medium truncate">{adminName || 'Admin'}</p>
            <p className="text-xs text-cream/45 truncate">{adminEmail || ''}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full text-left px-4 py-2 text-sm text-cream/45 hover:text-red-400 transition-colors duration-200 rounded-lg hover:bg-red-400/8"
        >
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-[260px] bg-admin-surface/95 backdrop-blur-sm border-r border-gold/12 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 h-full w-[260px] bg-admin-surface border-r border-gold/12 z-50 lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}