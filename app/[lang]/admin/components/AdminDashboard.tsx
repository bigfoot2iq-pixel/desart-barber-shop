'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AppointmentWithDetails, Professional } from '@/lib/types/database';
import { getPendingAppointments, getActiveProfessionals, assignProfessionalToAppointment, updateAppointmentStatus } from '@/lib/queries';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n/config';
import { formatDate, formatTimeFromHHMM, formatMoney } from '@/lib/i18n/format';
import { useT } from '@/lib/i18n/client-dictionary';
import AdminShell from './AdminShell';
import { Modal, useToast } from './ui';
import { AnimatePresence, motion } from 'framer-motion';

interface AdminDashboardProps {
  lang: Locale;
  initialPendingCount: number;
  adminName: string;
  adminEmail: string;
}

export default function AdminDashboard({ lang, initialPendingCount, adminName, adminEmail }: AdminDashboardProps) {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingApts, profs] = await Promise.all([
        getPendingAppointments(),
        getActiveProfessionals(lang),
      ]);
      setAppointments(pendingApts);
      setProfessionals(profs);
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemoved = useCallback((id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const pendingCount = appointments.length;

  return (
    <AdminShell
      lang={lang}
      section="dashboard"
      pendingCount={pendingCount}
      adminName={adminName}
      adminEmail={adminEmail}
    >
      <PendingAppointmentsList
        lang={lang}
        appointments={appointments}
        professionals={professionals}
        loading={loading}
        onRemoved={handleRemoved}
      />
    </AdminShell>
  );
}

interface PendingListProps {
  lang: Locale;
  appointments: AppointmentWithDetails[];
  professionals: Professional[];
  loading: boolean;
  onRemoved: (id: string) => void;
}

function PendingAppointmentsList({ lang, appointments, professionals, loading, onRemoved }: PendingListProps) {
  const tAdmin = useT('admin');
  const tCommon = useT('common');
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<AppointmentWithDetails | null>(null);

  const pendingCount = appointments.length;

  const handleAssign = async () => {
    if (!selectedAppointment || !selectedProfessionalId) return;
    setActionLoading(selectedAppointment.id);
    try {
      await assignProfessionalToAppointment(selectedAppointment.id, selectedProfessionalId);
      toast(tAdmin('appointments.toastProfessionalAssigned'));
      onRemoved(selectedAppointment.id);
      setAssignModalOpen(false);
      setSelectedProfessionalId('');
      setSelectedAppointment(null);
    } catch {
      toast(tAdmin('appointments.toastAssignFailed'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (apt: AppointmentWithDetails) => {
    setActionLoading(apt.id);
    try {
      await updateAppointmentStatus(apt.id, 'cancelled');
      toast(tAdmin('appointments.toastStatusUpdated', { status: tAdmin('status.cancelled') }));
      onRemoved(apt.id);
    } catch {
      toast(tAdmin('appointments.toastStatusUpdateFailed'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelClick = (apt: AppointmentWithDetails) => {
    setAppointmentToCancel(apt);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!appointmentToCancel) return;
    setCancelModalOpen(false);
    await handleCancel(appointmentToCancel);
    setAppointmentToCancel(null);
  };

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pendingCount} {pendingCount === 1 ? tAdmin('pending.single') : tAdmin('pending.plural')}
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-foreground font-medium mb-1">{tAdmin('pending.allDone')}</p>
            <p className="text-muted-foreground text-sm">{tAdmin('pending.allDoneDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence mode="popLayout">
          {appointments.map((apt) => {
            const preferredProf = apt.preferred_professional;
            const isExpanded = expandedId === apt.id;

            return (
              <motion.div
                key={apt.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div
                      className="p-4 cursor-pointer active:bg-white/5"
                      onClick={() => setExpandedId(isExpanded ? null : apt.id)}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-foreground font-semibold text-base">
                                {apt.customer?.first_name} {apt.customer?.last_name}
                              </p>
                              <p className="text-muted-foreground text-sm mt-0.5">
                                {formatDate(new Date(apt.appointment_date + 'T00:00:00'), lang)} {tAdmin('appointments.dateTimeSeparator')} {formatTimeFromHHMM(apt.start_time, lang)}
                              </p>
                            </div>
                            <span className="text-primary font-bold text-base flex-shrink-0">
                              {formatMoney(apt.total_price_mad, lang)}
                            </span>
                          </div>

                          {preferredProf && (
                            <div className="flex items-center gap-2 mt-2">
                              {preferredProf.profile_image_url ? (
                                <img
                                  src={preferredProf.profile_image_url}
                                  alt={preferredProf.display_name}
                                  className="w-6 h-6 rounded-full object-cover ring-1 ring-primary/20 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-playfair text-xs font-bold ring-1 ring-primary/20 flex-shrink-0">
                                  {preferredProf.display_name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                              )}
                              <p className="text-sm text-foreground/70">
                                {tAdmin('pending.wants')} <span className="text-foreground font-medium">{preferredProf.display_name}</span>
                              </p>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/10 text-neutral-300">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={apt.location_type === 'home'
                                  ? 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z'
                                  : 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.75m.75 0h.75m-.75 0h.75'
                                } />
                              </svg>
                              {apt.location_type === 'home' ? tAdmin('appointments.locationHome') : (apt.salon?.name || tAdmin('appointments.locationSalon'))}
                            </span>
                            {apt.services.slice(0, 2).map((s) => (
                              <span key={s.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-white/10 text-neutral-300">
                                {s.name}
                              </span>
                            ))}
                            {apt.services.length > 2 && (
                              <span className="text-xs text-muted-foreground">+{apt.services.length - 2}</span>
                            )}
                          </div>
                        </div>

                        <svg
                          className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 mt-1 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="border-t border-border px-4 py-3 space-y-3">
                            {apt.customer?.phone && (
                              <div className="flex items-center justify-between gap-2 text-sm">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                                  </svg>
                                  <span className="text-foreground truncate">{apt.customer.phone}</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        await navigator.clipboard.writeText(apt.customer!.phone!);
                                        toast('Phone number copied');
                                      } catch {
                                        toast('Failed to copy', 'error');
                                      }
                                    }}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                    title="Copy phone number"
                                  >
                                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                                    </svg>
                                  </button>
                                  <a
                                    href={`tel:${apt.customer.phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
                                    title="Call customer"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                                    </svg>
                                  </a>
                                </div>
                              </div>
                            )}

                            {apt.services.length > 0 && (
                              <div className="space-y-1">
                                {apt.services.map((s) => (
                                  <div key={s.id} className="flex justify-between text-sm">
                                    <span className="text-foreground/70">{s.name}</span>
                                    <span className="text-muted-foreground">{s.duration_minutes}min — {formatMoney(s.price_mad, lang)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {apt.notes && (
                              <div className="bg-white/5 rounded-lg p-3 text-sm">
                                <p className="text-muted-foreground">{apt.notes}</p>
                              </div>
                            )}

                            <div className="flex gap-2 pt-1">
                              <Button
                                className="flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppointment(apt);
                                  setSelectedProfessionalId(apt.preferred_professional_id || '');
                                  setAssignModalOpen(true);
                                }}
                                disabled={actionLoading !== null}
                              >
                                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {tAdmin('pending.confirm')}
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelClick(apt);
                                }}
                                disabled={actionLoading !== null}
                              >
                                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                {tAdmin('pending.cancel')}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}

      <Modal
        open={assignModalOpen}
        onClose={() => { setAssignModalOpen(false); setSelectedProfessionalId(''); setSelectedAppointment(null); }}
        title={tAdmin('appointments.modalAssignTitle')}
      >
        <div className="space-y-4">
          {selectedAppointment?.preferred_professional && (
            <div className="rounded-lg p-3 border border-primary/30 bg-primary/10">
              <p className="text-xs text-primary mb-1 font-medium">{tAdmin('appointments.customerPreferred')}</p>
              <div className="flex items-center gap-2">
                {selectedAppointment.preferred_professional.profile_image_url ? (
                  <img
                    src={selectedAppointment.preferred_professional.profile_image_url}
                    alt={selectedAppointment.preferred_professional.display_name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-playfair text-sm font-bold">
                    {selectedAppointment.preferred_professional.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="text-foreground font-medium">{selectedAppointment.preferred_professional.display_name}</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('appointments.selectProfessional')}</label>
            <select
              value={selectedProfessionalId}
              onChange={(e) => setSelectedProfessionalId(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">{tAdmin('appointments.chooseProfessional')}</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                  {p.id === selectedAppointment?.preferred_professional_id ? ` ${tAdmin('appointments.preferredBadge')}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => { setAssignModalOpen(false); setSelectedProfessionalId(''); setSelectedAppointment(null); }}>{tCommon('cancel')}</Button>
            <Button onClick={handleAssign} disabled={!selectedProfessionalId || actionLoading !== null}>
              {actionLoading ? tAdmin('appointments.assigning') : tAdmin('appointments.assignAndConfirm')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={cancelModalOpen}
        onClose={() => { setCancelModalOpen(false); setAppointmentToCancel(null); }}
        title={tAdmin('appointments.modalCancelTitle') ?? 'Confirm Cancellation'}
      >
        <div className="space-y-4">
          <p className="text-foreground/80 text-sm">
            {tAdmin('appointments.cancelConfirmMessage') ?? 'Are you sure you want to cancel this appointment? This action cannot be undone.'}
          </p>
          {appointmentToCancel && (
            <div className="rounded-lg p-3 border border-border bg-white/5 text-sm space-y-1">
              <p className="text-foreground font-medium">
                {appointmentToCancel.customer?.first_name} {appointmentToCancel.customer?.last_name}
              </p>
              <p className="text-muted-foreground">
                {formatDate(new Date(appointmentToCancel.appointment_date + 'T00:00:00'), lang)} {tAdmin('appointments.dateTimeSeparator')} {formatTimeFromHHMM(appointmentToCancel.start_time, lang)}
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => { setCancelModalOpen(false); setAppointmentToCancel(null); }}>{tCommon('cancel')}</Button>
            <Button variant="destructive" onClick={handleConfirmCancel} disabled={actionLoading !== null}>
              {actionLoading ? tAdmin('appointments.cancelling') ?? 'Cancelling...' : tAdmin('appointments.confirmCancel') ?? 'Cancel Appointment'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
