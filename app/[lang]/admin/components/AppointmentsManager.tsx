'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppointmentWithDetails, Professional, AppointmentStatus, AppointmentReview } from '@/lib/types/database';
import { getAllAppointments, assignProfessionalToAppointment, updateAppointmentStatus, getActiveProfessionals, searchAppointments } from '@/lib/queries';
import { getReviewForAppointment } from '@/lib/queries/reviews';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Modal, AdminBadge, useToast } from './ui';
import { SidePanel } from './ui/SidePanel';
import { formatDate, formatTimeFromHHMM, formatMoney } from '@/lib/i18n/format';
import { useT } from '@/lib/i18n/client-dictionary';
import type { Locale } from '@/lib/i18n/config';
import { useRouter, usePathname } from 'next/navigation';

type StatusFilter = 'all' | AppointmentStatus;

const STATUS_PRIORITY: Record<AppointmentStatus, number> = {
  confirmed: 0,
  pending: 1,
  completed: 2,
  cancelled: 3,
};

const statusBadgeVariants: Record<string, 'pending' | 'confirmed' | 'completed' | 'cancelled'> = {
  pending: 'pending',
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
};

const statusBarColors: Record<AppointmentStatus, string> = {
  confirmed: 'border-l-green-500',
  pending: 'border-l-amber-500',
  completed: 'border-l-blue-500',
  cancelled: 'border-l-red-500',
};

// Incoming (confirmed/pending) tinted to stand out; done/cancelled dimmed.
const statusCardTint: Record<AppointmentStatus, string> = {
  confirmed: 'bg-green-500/[0.04]',
  pending: 'bg-amber-500/[0.04]',
  completed: 'opacity-75',
  cancelled: 'opacity-60',
};

interface AppointmentsManagerProps {
  lang: Locale;
  initialAppointments: AppointmentWithDetails[];
  initialAppointmentId: string | null;
}

export default function AppointmentsManager({
  lang,
  initialAppointments,
  initialAppointmentId,
}: AppointmentsManagerProps) {
  const tAdmin = useT('admin');
  const tCommon = useT('common');
  const router = useRouter();
  const pathname = usePathname();
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>(initialAppointments);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('confirmed');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningAppointment, setAssigningAppointment] = useState<AppointmentWithDetails | null>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelTargetApt, setCancelTargetApt] = useState<AppointmentWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<AppointmentReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getActiveProfessionals(lang).then(setProfessionals).catch(() => {});
  }, [lang]);

  useEffect(() => {
    if (initialAppointmentId) {
      const apt = appointments.find((a) => a.id === initialAppointmentId);
      if (apt) {
        setSelectedAppointment(apt);
        getReviewForAppointment(apt.id).then(setSelectedReview).catch(() => setSelectedReview(null));
      }
    }
  }, [initialAppointmentId, appointments]);

  const refreshAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllAppointments();
      setAppointments(data);
    } catch {
      toast(tAdmin('appointments.toastLoadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast, tAdmin]);

  useEffect(() => {
    refreshAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery && !dateRange.from && !dateRange.to) {
      setAppointments(initialAppointments);
      return;
    }
    setLoading(true);
    try {
      const data = await searchAppointments(searchQuery, undefined);
      let filtered = data;
      if (dateRange.from) filtered = filtered.filter((a) => a.appointment_date >= dateRange.from);
      if (dateRange.to) filtered = filtered.filter((a) => a.appointment_date <= dateRange.to);
      setAppointments(filtered);
    } catch {
      toast(tAdmin('appointments.toastSearchFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, dateRange, toast, tAdmin, initialAppointments]);

  const handleAssign = async () => {
    if (!assigningAppointment || !selectedProfessionalId) return;
    setActionLoading(assigningAppointment.id);
    try {
      await assignProfessionalToAppointment(assigningAppointment.id, selectedProfessionalId);
      toast(tAdmin('appointments.toastProfessionalAssigned'));
      setAssignModalOpen(false);
      setSelectedProfessionalId('');
      setAssigningAppointment(null);
      refreshAppointments();
    } catch {
      toast(tAdmin('appointments.toastAssignFailed'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    setActionLoading(appointmentId);
    try {
      await updateAppointmentStatus(appointmentId, newStatus);
      toast(tAdmin('appointments.toastStatusUpdated', { status: tAdmin(`status.${newStatus}`) }));
      refreshAppointments();
      if (selectedAppointment?.id === appointmentId) {
        setSelectedAppointment({ ...selectedAppointment, status: newStatus });
      }
    } catch {
      toast(tAdmin('appointments.toastStatusUpdateFailed'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const openSidePanel = async (apt: AppointmentWithDetails) => {
    setSelectedAppointment(apt);
    const params = new URLSearchParams();
    params.set('appointment', apt.id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setReviewLoading(true);
    const review = await getReviewForAppointment(apt.id);
    setSelectedReview(review);
    setReviewLoading(false);
  };

  const closeSidePanel = () => {
    setSelectedAppointment(null);
    setSelectedReview(null);
    router.push(pathname, { scroll: false });
  };

  const promptCancel = (apt: AppointmentWithDetails) => {
    setCancelTargetId(apt.id);
    setCancelTargetApt(apt);
  };

  const confirmCancel = () => {
    if (cancelTargetId) {
      handleStatusChange(cancelTargetId, 'cancelled');
    }
    setCancelTargetId(null);
    setCancelTargetApt(null);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: appointments.length,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    appointments.forEach((a) => {
      if (a.status in counts) counts[a.status as StatusFilter]++;
    });
    return counts;
  }, [appointments]);

  const filtered = appointments.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (dateRange.from && a.appointment_date < dateRange.from) return false;
    if (dateRange.to && a.appointment_date > dateRange.to) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = `${a.customer?.first_name ?? ''} ${a.customer?.last_name ?? ''}`.toLowerCase();
      const phone = a.customer?.phone?.toLowerCase() ?? '';
      if (!name.includes(q) && !phone.includes(q)) return false;
    }
    return true;
  });

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const sa = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (sa !== 0) return sa;
      const ascending = a.status === 'confirmed' || a.status === 'pending';
      const cmp = a.appointment_date.localeCompare(b.appointment_date)
               || a.start_time.localeCompare(b.start_time);
      return ascending ? cmp : -cmp;
    });
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('appointments.searchPlaceholder')}</Label>
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={tAdmin('appointments.searchPlaceholder')}
            className="mt-1"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('appointments.dateRangeLabel')}</Label>
          <div className="mt-1">
            <DateRangePicker
              value={dateRange}
              onChange={(range) => setDateRange(range)}
              placeholder={tAdmin('appointments.dateRangePlaceholder')}
            />
          </div>
        </div>
        <Button onClick={handleSearch} size="sm">{tAdmin('appointments.search')}</Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as StatusFilter[]).map((s) => {
          const count = statusCounts[s];
          const isActive = statusFilter === s;
          const hasCount = count > 0;
          return (
            <Button
              key={s}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className={isActive && hasCount ? '' : !isActive && hasCount ? 'border-primary/40 text-primary' : ''}
            >
              {s === 'all' ? tAdmin('appointments.filterAll') : tAdmin(`status.${s}`)}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${isActive ? 'opacity-80' : 'opacity-60'}`}>({count})</span>
              )}
            </Button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4 mb-3" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            {statusFilter !== 'all' ? (
              <>
                <p className="text-muted-foreground mb-4">
                  {tAdmin('appointments.noAppointmentsForStatus', { status: tAdmin(`status.${statusFilter}`) })}
                </p>
                <Button variant="link" size="sm" onClick={() => setStatusFilter('all')}>
                  {tAdmin('appointments.showAll')} →
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground mb-4">{tAdmin('appointments.noAppointments')}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sorted.map((apt) => (
              <motion.div
                key={apt.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card
                  className={`cursor-pointer hover:border-primary/30 transition-colors border-l-4 ${statusBarColors[apt.status]} ${statusCardTint[apt.status]}`}
                  onClick={() => openSidePanel(apt)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center min-w-[60px]">
                        <span className="text-foreground font-semibold text-base">
                          {formatTimeFromHHMM(apt.start_time, lang)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatDate(new Date(apt.appointment_date + 'T00:00:00'), lang)}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-foreground font-medium">
                            {apt.customer?.first_name} {apt.customer?.last_name}
                          </span>
                          <AdminBadge variant={statusBadgeVariants[apt.status]}>
                            {tAdmin(`status.${apt.status}`)}
                          </AdminBadge>
                          {apt.party_size > 1 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-amber-500/15 text-amber-300 border-amber-500/30">
                              {tAdmin('appointments.groupOf', { count: apt.party_size })}
                            </span>
                          )}
                          {apt.notes && (
                            <span className="text-xs" title={tAdmin('appointments.withNote')}>📝</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span>{apt.customer?.phone || '—'}</span>
                          <span>·</span>
                          <span className="truncate">
                            {apt.location_type === 'home'
                              ? tAdmin('appointments.locationHome')
                              : apt.salon?.name || tAdmin('appointments.locationSalon')}
                          </span>
                          <span>·</span>
                          <span className="truncate">{apt.services.map((s) => s.name).join(', ')}</span>
                        </div>

                        {apt.notes && (
                          <div className="mt-2 text-xs italic text-amber-600 dark:text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded px-2.5 py-1.5 line-clamp-2">
                            📝 &ldquo;{apt.notes}&rdquo;
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-2.5">
                          {apt.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssigningAppointment(apt);
                                  setSelectedProfessionalId(apt.preferred_professional_id || '');
                                  setAssignModalOpen(true);
                                }}
                              >
                                {tAdmin('appointments.assignProfessional')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  promptCancel(apt);
                                }}
                                disabled={actionLoading === apt.id}
                              >
                                {tAdmin('appointments.cancelAppointment')}
                              </Button>
                            </>
                          )}
                          {apt.status === 'confirmed' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(apt.id, 'completed');
                                }}
                                disabled={actionLoading === apt.id}
                              >
                                {tAdmin('appointments.markCompleted')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  promptCancel(apt);
                                }}
                                disabled={actionLoading === apt.id}
                              >
                                {tAdmin('appointments.cancelAppointment')}
                              </Button>
                            </>
                          )}
                          {(apt.status === 'completed' || apt.status === 'cancelled') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSidePanel(apt);
                              }}
                            >
                              {tAdmin('appointments.viewDetails')} →
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 hidden sm:block">
                        <span className="text-primary font-semibold">
                          {formatMoney(apt.total_price_mad, lang)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <SidePanel
        open={!!selectedAppointment}
        onClose={closeSidePanel}
        title={tAdmin('appointments.modalDetailsTitle')}
      >
        {selectedAppointment && (
          <div className="divide-y divide-border">
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <AdminBadge variant={statusBadgeVariants[selectedAppointment.status]}>
                  {tAdmin(`status.${selectedAppointment.status}`)}
                </AdminBadge>
                <span className="text-sm text-muted-foreground">
                  {formatDate(new Date(selectedAppointment.appointment_date + 'T00:00:00'), lang)}{' '}
                  {tAdmin('appointments.dateTimeSeparator')}{' '}
                  {formatTimeFromHHMM(selectedAppointment.start_time, lang)}{' '}
                  {tAdmin('appointments.timeRangeSeparator')}{' '}
                  {formatTimeFromHHMM(selectedAppointment.end_time, lang)}
                </span>
              </div>

              <div>
                <p className="text-foreground font-medium text-base">
                  {selectedAppointment.customer?.first_name} {selectedAppointment.customer?.last_name}
                </p>
                {selectedAppointment.customer?.phone && (
                  <a
                    href={`tel:${selectedAppointment.customer.phone}`}
                    className="text-sm text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {tAdmin('appointments.tapToCall')}: {selectedAppointment.customer.phone}
                  </a>
                )}
              </div>

              {selectedAppointment.status === 'pending' && (
                <Button
                  onClick={() => {
                    setAssigningAppointment(selectedAppointment);
                    setSelectedProfessionalId(selectedAppointment.preferred_professional_id || '');
                    setAssignModalOpen(true);
                  }}
                  className="w-full"
                >
                  {tAdmin('appointments.assignProfessional')}
                </Button>
              )}
              {selectedAppointment.status === 'confirmed' && (
                <Button
                  onClick={() => handleStatusChange(selectedAppointment.id, 'completed')}
                  disabled={actionLoading === selectedAppointment.id}
                  className="w-full"
                >
                  {tAdmin('appointments.markCompleted')}
                </Button>
              )}
              {(selectedAppointment.status === 'pending' || selectedAppointment.status === 'confirmed') && (
                <Button
                  variant="destructive"
                  onClick={() => promptCancel(selectedAppointment)}
                  disabled={actionLoading === selectedAppointment.id}
                  className="w-full"
                >
                  {tAdmin('appointments.cancelAppointment')}
                </Button>
              )}
            </div>

            {selectedAppointment.notes && (
              <div className="px-5 py-4 bg-amber-500/5 border-y border-amber-500/20">
                <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                  {tAdmin('appointments.noteSectionTitle')}
                </h3>
                <p className="text-sm text-foreground italic">&ldquo;{selectedAppointment.notes}&rdquo;</p>
              </div>
            )}

            {(selectedReview || reviewLoading) && (
              <AccordionSection title={tAdmin('appointments.panelReviewTitle')}>
                {reviewLoading ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="w-4 h-4 rounded bg-muted" />
                      ))}
                    </div>
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                ) : selectedReview ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-4 h-4 ${star <= selectedReview.rating ? 'text-amber-400' : 'text-muted-foreground/30'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    {selectedReview.comment ? (
                      <p className="text-sm text-foreground/80 italic">&ldquo;{selectedReview.comment}&rdquo;</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{tAdmin('appointments.noReviewComment')}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedReview.created_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{tAdmin('appointments.noReviewYet')}</p>
                )}
              </AccordionSection>
            )}

            <AccordionSection title={tAdmin('appointments.panelServicesTitle')} defaultOpen>
              <div className="space-y-2">
                {selectedAppointment.party_size > 1 && selectedAppointment.guests.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {selectedAppointment.guests.map((g) => (
                      <div key={g.id} className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5">
                        <div className="text-xs font-semibold text-foreground/90">{g.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {g.services.map((s) => s.name).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedAppointment.services.map((s) => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span className="text-foreground/85">{s.name}</span>
                    <span className="text-muted-foreground">
                      {s.duration_minutes} {tAdmin('services.minAbbr')} — {formatMoney(s.price_mad, lang)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 mt-2 flex justify-between text-sm font-semibold">
                  <span className="text-primary">{tAdmin('appointments.total')}</span>
                  <span className="text-primary">{formatMoney(selectedAppointment.total_price_mad, lang)}</span>
                </div>
                {selectedAppointment.tip_mad > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{tAdmin('appointments.tip')}</span>
                      <span className="text-muted-foreground">+{formatMoney(selectedAppointment.tip_mad, lang)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-primary">{tAdmin('appointments.grandTotal')}</span>
                      <span className="text-primary">
                        {formatMoney(selectedAppointment.total_price_mad + selectedAppointment.tip_mad, lang)}
                      </span>
                    </div>
                  </>
                )}
                {selectedAppointment.location_type === 'home' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{tAdmin('appointments.homeVisitSurcharge')}</span>
                    <span className="text-muted-foreground">
                      {formatMoney(Number(process.env.NEXT_PUBLIC_HOME_VISIT_SURCHARGE_MAD) || 30, lang)}
                    </span>
                  </div>
                )}
              </div>
            </AccordionSection>

            <AccordionSection title={tAdmin('appointments.panelLocationTitle')}>
              {selectedAppointment.location_type === 'home' ? (
                <div className="space-y-2">
                  <p className="text-foreground/85 text-sm">{selectedAppointment.home_address || tAdmin('appointments.homeVisit')}</p>
                  {selectedAppointment.home_details?.accessNotes?.trim() && (
                    <div className="rounded-lg bg-muted/40 p-3 text-xs">
                      <p className="text-muted-foreground mb-0.5">{tAdmin('appointments.homeAccess')}</p>
                      <p className="text-foreground/85 whitespace-pre-wrap">{selectedAppointment.home_details.accessNotes}</p>
                    </div>
                  )}
                  {selectedAppointment.home_latitude != null && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedAppointment.home_latitude},${selectedAppointment.home_longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
                    >
                      {tAdmin('appointments.openInMaps')} ({selectedAppointment.home_latitude.toFixed(6)}, {selectedAppointment.home_longitude?.toFixed(6)})
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-foreground/85 text-sm">
                  {selectedAppointment.salon?.name || tAdmin('appointments.locationSalon')} — {selectedAppointment.salon?.address || ''}
                </p>
              )}
            </AccordionSection>

            <AccordionSection title={tAdmin('appointments.panelProfessionalTitle')}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tAdmin('appointments.preferred')}</span>
                  <span className="text-foreground/85">{selectedAppointment.preferred_professional?.display_name || tAdmin('appointments.anyAvailable')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tAdmin('appointments.columnAssigned')}</span>
                  <span className="text-foreground/85">{selectedAppointment.professional?.display_name || tAdmin('appointments.notAssigned')}</span>
                </div>
              </div>
            </AccordionSection>

            <AccordionSection title={tAdmin('appointments.panelPaymentTitle')}>
              <p className="text-foreground/85 text-sm">
                {tAdmin(`appointments.paymentMethods.${selectedAppointment.payment_method}`)}
              </p>
            </AccordionSection>

            <AccordionSection title={tAdmin('appointments.panelCreatedAt')}>
              <p className="text-muted-foreground text-xs">
                {new Date(selectedAppointment.created_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}
              </p>
            </AccordionSection>
          </div>
        )}
      </SidePanel>

      <Modal
        open={assignModalOpen}
        onClose={() => { setAssignModalOpen(false); setSelectedProfessionalId(''); setAssigningAppointment(null); }}
        title={tAdmin('appointments.modalAssignTitle')}
      >
        <div className="space-y-4">
          {assigningAppointment?.preferred_professional && (
            <div className="rounded-lg p-3 border border-primary/30 bg-primary/10">
              <p className="text-xs text-primary mb-1 font-medium">{tAdmin('appointments.customerPreferred')}</p>
              <p className="text-foreground font-medium">{assigningAppointment.preferred_professional.display_name}</p>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('appointments.selectProfessional')}</Label>
            <select
              value={selectedProfessionalId}
              onChange={(e) => setSelectedProfessionalId(e.target.value)}
              className="mt-1 flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">{tAdmin('appointments.chooseProfessional')}</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                  {p.id === assigningAppointment?.preferred_professional_id ? ` ${tAdmin('appointments.preferredBadge')}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => { setAssignModalOpen(false); setSelectedProfessionalId(''); setAssigningAppointment(null); }}>{tCommon('cancel')}</Button>
            <Button onClick={handleAssign} disabled={!selectedProfessionalId || actionLoading !== null}>
              {actionLoading ? tAdmin('appointments.assigning') : tAdmin('appointments.assignAndConfirm')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!cancelTargetId}
        onClose={() => { setCancelTargetId(null); setCancelTargetApt(null); }}
        title={tAdmin('appointments.modalCancelTitle')}
        maxWidth="sm:max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {tAdmin('appointments.cancelConfirmMessage')}
          </p>
          {cancelTargetApt && (
            <div className="rounded-lg p-3 border border-destructive/20 bg-destructive/5">
              <p className="text-sm font-medium text-foreground">
                {cancelTargetApt.customer?.first_name} {cancelTargetApt.customer?.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(new Date(cancelTargetApt.appointment_date + 'T00:00:00'), lang)} {formatTimeFromHHMM(cancelTargetApt.start_time, lang)}
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => { setCancelTargetId(null); setCancelTargetApt(null); }}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={actionLoading !== null}
            >
              {actionLoading ? tAdmin('appointments.cancelling') : tAdmin('appointments.confirmCancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AccordionSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="px-5 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">
          {title}
        </h3>
        <span className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
