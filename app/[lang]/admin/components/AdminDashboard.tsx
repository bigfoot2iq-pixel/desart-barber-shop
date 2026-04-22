'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppointmentWithDetails, Professional, Salon, Service } from '@/lib/types/database';
import { getPendingAppointments, getTodayAppointmentsCount, getActiveProfessionalsCount, getActiveServicesCount, getAllAppointments, getAllProfessionals, getAllServices, getAllSalons } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { localeHref } from '@/lib/i18n/href';
import type { Locale } from '@/lib/i18n/config';
import { formatDate, formatTimeFromHHMM, formatMoney } from '@/lib/i18n/format';
import { DictionaryProvider, useT } from '@/lib/i18n/client-dictionary';
import Sidebar, { type Section } from './Sidebar';
import StatsCards from './StatsCards';
import AppointmentsManager from './AppointmentsManager';
import ProfessionalsManager from './ProfessionalsManager';
import ServicesManager from './ServicesManager';
import SalonsManager from './SalonsManager';
import NotificationsManager from './NotificationsManager';
import PaymentSettingsManager from './PaymentSettingsManager';
import { ToastProvider } from './ui';

interface AdminDashboardProps {
  lang: Locale;
  initialPendingCount: number;
  adminName: string;
  adminEmail: string;
  adminDict: Record<string, unknown>;
  commonDict: Record<string, unknown>;
}

function AdminDashboardInner({ lang, initialPendingCount, adminName, adminEmail }: Omit<AdminDashboardProps, 'adminDict' | 'commonDict'>) {
  const router = useRouter();
  const tAdmin = useT('admin');
  const tCommon = useT('common');
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

  const handleSectionChange = useCallback((section: Section) => {
    if (section === 'payment') {
      router.push(localeHref(lang, '/admin/payment'));
    } else {
      setActiveSection(section);
    }
  }, [router, lang]);

  const handleNavigateToPayment = useCallback(() => {
    router.push(localeHref(lang, '/admin/payment'));
  }, [router, lang]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const recentPending = appointments
    .filter((a) => a.status === 'pending')
    .slice(0, 5);

  const stats = [
    { label: tAdmin('stats.pending'), value: pendingCount, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-white/10 text-white' },
    { label: tAdmin('stats.todayAppointments'), value: todayCount, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'bg-neutral-400/15 text-neutral-300' },
    { label: tAdmin('stats.activeProfessionals'), value: activeProfsCount, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'bg-neutral-400/15 text-neutral-300' },
    { label: tAdmin('stats.activeServices'), value: activeServicesCount, icon: 'M14.121 14.121L19 19m-4.879-4.879l-2.652 2.652a3 3 0 01-4.243 0l-.59-.59a3 3 0 010-4.243l2.652-2.652m4.833 4.833L9.9 9.9m4.833 4.833l2.652-2.652a3 3 0 000-4.243l-.59-.59a3 3 0 00-4.243 0l-2.652 2.652', color: 'bg-neutral-400/15 text-neutral-300' },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            <StatsCards stats={stats} loading={statsLoading} />

            <div>
              <h3 className="font-playfair text-lg text-foreground mb-4">{tAdmin('dashboard.recentPending')}</h3>
              {recentPending.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">{tAdmin('dashboard.noPending')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {recentPending.map((apt) => (
                    <Card
                      key={apt.id}
                      className="cursor-pointer hover:border-primary/30 transition-colors"
                      onClick={() => setActiveSection('appointments')}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-foreground font-medium text-sm">
                              {apt.customer?.first_name} {apt.customer?.last_name}
                            </p>
                            <p className="text-muted-foreground text-xs mt-0.5">
                              {formatDate(new Date(apt.appointment_date + 'T00:00:00'), lang)} {tAdmin('appointments.dateTimeSeparator')} {formatTimeFromHHMM(apt.start_time, lang)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-primary text-sm font-semibold">{formatMoney(apt.total_price_mad, lang)}</span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              apt.status === 'pending' ? 'bg-white/10 text-neutral-300 border-white/20' :
                              apt.status === 'confirmed' ? 'bg-neutral-400/15 text-neutral-300 border-neutral-400/30' :
                              apt.status === 'completed' ? 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30' :
                              'bg-red-500/20 text-red-400 border-red-500/40'
                            }`}>
                              {tAdmin(`status.${apt.status}`)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {pendingCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveSection('appointments')}
                  className="mt-4 text-primary hover:text-primary/80"
                >
                  {tAdmin('dashboard.viewAll')}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {([
                { section: 'appointments' as Section, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                { section: 'professionals' as Section, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
                { section: 'services' as Section, icon: 'M14.121 14.121L19 19m-4.879-4.879l-2.652 2.652a3 3 0 01-4.243 0l-.59-.59a3 3 0 010-4.243l2.652-2.652m4.833 4.833L9.9 9.9m4.833 4.833l2.652-2.652a3 3 0 000-4.243l-.59-.59a3 3 0 00-4.243 0l-2.652 2.652' },
                { section: 'salons' as Section, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
                { section: 'notifications' as Section, icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
                { section: 'payment' as Section, icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
              ] as const).map(({ section, icon }) => (
                <Card
                  key={section}
                  className="cursor-pointer group hover:border-primary/30 transition-colors"
                  onClick={() => setActiveSection(section)}
                >
                  <CardContent className="p-4">
                    <svg className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                    <p className="text-foreground font-medium text-sm">{tAdmin(`nav.${section}`)}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{tAdmin(`quickCards.${section}.desc`)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      case 'appointments':
        return <AppointmentsManager lang={lang} initialAppointments={appointments} />;
      case 'professionals':
        return <ProfessionalsManager lang={lang} initialProfessionals={professionals} initialSalons={salons} />;
      case 'services':
        return <ServicesManager lang={lang} initialServices={services} />;
      case 'salons':
        return <SalonsManager initialSalons={salons} />;
      case 'notifications':
        return <NotificationsManager lang={lang} />;
    }
  };

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar
          active={activeSection}
          onChange={handleSectionChange}
          pendingCount={pendingCount}
          adminName={adminName}
          adminEmail={adminEmail}
          onSignOut={signOut}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          onNavigateToPayment={handleNavigateToPayment}
        />

        <main className="flex-1 min-w-0">
          <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border px-4 lg:px-8 py-4 flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h2 className="font-playfair text-lg text-foreground font-semibold">{tAdmin(`nav.${activeSection}`)}</h2>
            <div className="ml-auto flex items-center gap-3 lg:hidden">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-playfair text-sm font-bold ring-1 ring-primary/25">
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

export default function AdminDashboard(props: AdminDashboardProps) {
  return (
    <DictionaryProvider value={{ admin: props.adminDict, common: props.commonDict }}>
      <AdminDashboardInner {...props} />
    </DictionaryProvider>
  );
}