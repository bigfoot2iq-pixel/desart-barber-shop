'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppointmentWithDetails, Professional, Salon, Service } from '@/lib/types/database';
import { getPendingAppointments, getTodayAppointmentsCount, getActiveProfessionalsCount, getActiveServicesCount, getAllAppointments, getAllProfessionals, getAllServices, getAllSalons } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import Sidebar, { type Section } from './Sidebar';
import StatsCards from './StatsCards';
import AppointmentsManager from './AppointmentsManager';
import ProfessionalsManager from './ProfessionalsManager';
import ServicesManager from './ServicesManager';
import SalonsManager from './SalonsManager';
import { ToastProvider } from './ui';

interface AdminDashboardProps {
  initialPendingCount: number;
  adminName: string;
  adminEmail: string;
}

export default function AdminDashboard({ initialPendingCount, adminName, adminEmail }: AdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [statsLoading, setStatsLoading] = useState(true);
  const { signOut } = useAuth();

  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [professionals, setProfessionals] = useState<(Professional & { salon: Salon | null })[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [salons, setSalons] = useState<Salon[]>([]);

  const [todayCount, setTodayCount] = useState(0);
  const [activeProfsCount, setActiveProfsCount] = useState(0);
  const [activeServicesCount, setActiveServicesCount] = useState(0);

  const loadData = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [pendingApts, allApts, todayCnt, profsCount, servsCount, profs, servs, slns] = await Promise.all([
        getPendingAppointments(),
        getAllAppointments(),
        getTodayAppointmentsCount(),
        getActiveProfessionalsCount(),
        getActiveServicesCount(),
        getAllProfessionals(),
        getAllServices(),
        getAllSalons(),
      ]);
      setPendingCount(pendingApts.length);
      setAppointments(allApts);
      setTodayCount(todayCnt);
      setActiveProfsCount(profsCount);
      setActiveServicesCount(servsCount);
      setProfessionals(profs);
      setServices(servs);
      setSalons(slns);
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const recentPending = appointments
    .filter((a) => a.status === 'pending')
    .slice(0, 5);

  const stats = [
    { label: 'Pending', value: pendingCount, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-amber-500/20 text-amber-300' },
    { label: "Today's Appointments", value: todayCount, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'bg-sky-500/20 text-sky-300' },
    { label: 'Active Professionals', value: activeProfsCount, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'bg-emerald-500/20 text-emerald-300' },
    { label: 'Active Services', value: activeServicesCount, icon: 'M14.121 14.121L19 19m-4.879-4.879l-2.652 2.652a3 3 0 01-4.243 0l-.59-.59a3 3 0 010-4.243l2.652-2.652m4.833 4.833L9.9 9.9m4.833 4.833l2.652-2.652a3 3 0 000-4.243l-.59-.59a3 3 0 00-4.243 0l-2.652 2.652', color: 'bg-violet-500/20 text-violet-300' },
  ];

  const formatDate = (date: string) => {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            <StatsCards stats={stats} loading={statsLoading} />

            <div>
              <h3 className="font-playfair text-lg text-cream mb-4">Recent Pending Appointments</h3>
              {recentPending.length === 0 ? (
                <div className="admin-card p-8 text-center">
                  <p className="text-cream/45">No pending appointments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPending.map((apt) => (
                    <div
                      key={apt.id}
                      className="admin-card p-4 cursor-pointer"
                      onClick={() => setActiveSection('appointments')}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-cream font-medium text-sm">
                            {apt.customer?.first_name} {apt.customer?.last_name}
                          </p>
                          <p className="text-cream/55 text-xs mt-0.5">
                            {formatDate(apt.appointment_date)} at {formatTime(apt.start_time)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gold3 text-sm font-semibold">{apt.total_price_mad} MAD</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            apt.status === 'pending' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                            apt.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                            apt.status === 'completed' ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' :
                            'bg-red-500/20 text-red-300 border-red-500/40'
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {pendingCount > 0 && (
                <button
                  onClick={() => setActiveSection('appointments')}
                  className="mt-4 text-gold3 text-sm hover:text-gold4 transition-colors duration-200 font-medium"
                >
                  View all appointments &rarr;
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { section: 'appointments' as Section, label: 'Appointments', desc: 'Manage bookings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                { section: 'professionals' as Section, label: 'Professionals', desc: 'Manage barbers', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
                { section: 'services' as Section, label: 'Services', desc: 'Manage catalog', icon: 'M14.121 14.121L19 19m-4.879-4.879l-2.652 2.652a3 3 0 01-4.243 0l-.59-.59a3 3 0 010-4.243l2.652-2.652m4.833 4.833L9.9 9.9m4.833 4.833l2.652-2.652a3 3 0 000-4.243l-.59-.59a3 3 0 00-4.243 0l-2.652 2.652' },
                { section: 'salons' as Section, label: 'Salons', desc: 'Manage locations', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
              ].map(({ section, label, desc, icon }) => (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className="admin-card p-4 text-left group"
                >
                  <svg className="w-5 h-5 text-gold3 mb-2 group-hover:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                  </svg>
                  <p className="text-cream font-medium text-sm">{label}</p>
                  <p className="text-cream/45 text-xs mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        );
      case 'appointments':
        return <AppointmentsManager initialAppointments={appointments} />;
      case 'professionals':
        return <ProfessionalsManager initialProfessionals={professionals} initialSalons={salons} />;
      case 'services':
        return <ServicesManager initialServices={services} />;
      case 'salons':
        return <SalonsManager initialSalons={salons} />;
    }
  };

  return (
    <ToastProvider>
      <div className="flex min-h-screen admin-bg">
        <Sidebar
          active={activeSection}
          onChange={setActiveSection}
          pendingCount={pendingCount}
          adminName={adminName}
          adminEmail={adminEmail}
          onSignOut={signOut}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        <main className="flex-1 min-w-0">
          <div className="sticky top-0 z-30 bg-brand-black/85 backdrop-blur-md border-b border-gold/12 px-4 lg:px-8 py-4 flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-cream/70 hover:text-cream transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h2 className="font-playfair text-lg text-cream capitalize font-semibold">{activeSection}</h2>
            <div className="ml-auto flex items-center gap-3 lg:hidden">
              <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold3 font-playfair text-sm font-bold ring-1 ring-gold/25">
                {adminName?.charAt(0)?.toUpperCase() || 'A'}
              </div>
            </div>
          </div>

          <div className="px-4 lg:px-8 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderSection()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}