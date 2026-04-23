'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppointmentWithDetails, Professional, AppointmentStatus } from '@/lib/types/database';
import { getAllAppointments, assignProfessionalToAppointment, updateAppointmentStatus, getActiveProfessionals, searchAppointments } from '@/lib/queries';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Modal, AdminBadge, useToast } from './ui';
import { formatDate, formatTimeFromHHMM, formatMoney } from '@/lib/i18n/format';
import { useT } from '@/lib/i18n/client-dictionary';
import type { Locale } from '@/lib/i18n/config';

type StatusFilter = 'all' | AppointmentStatus;

const statusBadgeVariants: Record<string, 'pending' | 'confirmed' | 'completed' | 'cancelled'> = {
  pending: 'pending',
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
};

interface AppointmentsManagerProps {
  lang: Locale;
  initialAppointments: AppointmentWithDetails[];
}

export default function AppointmentsManager({ lang, initialAppointments }: AppointmentsManagerProps) {
  const tAdmin = useT('admin');
  const tCommon = useT('common');
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>(initialAppointments);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningAppointment, setAssigningAppointment] = useState<AppointmentWithDetails | null>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    getActiveProfessionals(lang).then(setProfessionals).catch(() => {});
  }, [lang]);

  const refreshAppointments = useCallback(async (filter?: StatusFilter) => {
    setLoading(true);
    try {
      const activeFilter = filter ?? statusFilter;
      const data = await getAllAppointments(activeFilter === 'all' ? undefined : activeFilter);
      setAppointments(data);
    } catch {
      toast(tAdmin('appointments.toastLoadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast, tAdmin]);

  useEffect(() => {
    refreshAppointments();
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery && !dateRange.from && !dateRange.to) {
      refreshAppointments();
      return;
    }
    setLoading(true);
    try {
      const data = await searchAppointments(searchQuery, statusFilter === 'all' ? undefined : statusFilter);
      let filtered = data;
      if (dateRange.from) filtered = filtered.filter((a) => a.appointment_date >= dateRange.from);
      if (dateRange.to) filtered = filtered.filter((a) => a.appointment_date <= dateRange.to);
      setAppointments(filtered);
    } catch {
      toast(tAdmin('appointments.toastSearchFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, dateRange, statusFilter, toast, refreshAppointments, tAdmin]);

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

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
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
            <Button onClick={handleSearch}>{tAdmin('appointments.search')}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as StatusFilter[]).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter(s);
              refreshAppointments(s);
            }}
          >
            {s === 'all' ? tAdmin('appointments.filterAll') : tAdmin(`status.${s}`)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4 mb-3" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">{tAdmin('appointments.noAppointments')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((apt) => (
              <motion.div
                key={apt.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="cursor-pointer hover:border-primary/30 transition-colors">
                  <CardContent
                    className="p-4"
                    onClick={() => setSelectedAppointment(apt)}
                  >
                    <div className="flex flex-wrap items-center gap-2 md:hidden mb-2">
                      <span className="text-foreground font-medium text-sm">{formatDate(new Date(apt.appointment_date + 'T00:00:00'), lang)}</span>
                      <span className="text-muted-foreground text-sm">{formatTimeFromHHMM(apt.start_time, lang)} - {formatTimeFromHHMM(apt.end_time, lang)}</span>
                      <AdminBadge variant={statusBadgeVariants[apt.status]}>{tAdmin(`status.${apt.status}`)}</AdminBadge>
                    </div>
                    <p className="text-foreground font-medium md:hidden">
                      {apt.customer?.first_name} {apt.customer?.last_name}
                    </p>
                    <p className="text-muted-foreground text-xs md:hidden">
                      {apt.services.map((s) => s.name).join(', ')}
                    </p>

                    <div className="hidden md:grid grid-cols-[100px_120px_1fr_1fr_1fr_80px_100px_80px] gap-3 items-center text-sm">
                      <span className="text-foreground/85">{formatDate(new Date(apt.appointment_date + 'T00:00:00'), lang)}</span>
                      <span className="text-muted-foreground">{formatTimeFromHHMM(apt.start_time, lang)}</span>
                      <span className="text-foreground font-medium truncate">{apt.customer?.first_name} {apt.customer?.last_name}</span>
                      <span className="text-muted-foreground truncate">{apt.preferred_professional?.display_name || tAdmin('appointments.anyAvailable')}</span>
                      <span className="text-muted-foreground truncate">{apt.professional?.display_name || '—'}</span>
                      <span className="text-primary font-semibold">{formatMoney(apt.total_price_mad, lang)}</span>
                      <AdminBadge variant={statusBadgeVariants[apt.status]}>{tAdmin(`status.${apt.status}`)}</AdminBadge>
                      <span className="text-muted-foreground truncate text-xs">{apt.location_type === 'home' ? tAdmin('appointments.locationHome') : apt.salon?.name || tAdmin('appointments.locationSalon')}</span>
                    </div>

                    {apt.status === 'pending' && (
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssigningAppointment(apt);
                            setSelectedProfessionalId(apt.preferred_professional_id || '');
                            setAssignModalOpen(true);
                          }}
                        >
                          {tAdmin('appointments.assignProfessional')}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Modal
        open={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        title={tAdmin('appointments.modalDetailsTitle')}
        maxWidth="sm:max-w-2xl"
      >
        {selectedAppointment && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <AdminBadge variant={statusBadgeVariants[selectedAppointment.status]}>
                {tAdmin(`status.${selectedAppointment.status}`)}
              </AdminBadge>
              <span className="text-muted-foreground text-sm">
                {formatDate(new Date(selectedAppointment.appointment_date + 'T00:00:00'), lang)} {tAdmin('appointments.dateTimeSeparator')} {formatTimeFromHHMM(selectedAppointment.start_time, lang)} {tAdmin('appointments.timeRangeSeparator')} {formatTimeFromHHMM(selectedAppointment.end_time, lang)}
              </span>
            </div>

            <div className="rounded-lg p-4 border border-border">
              <h3 className="text-sm font-semibold text-primary mb-2">{tAdmin('appointments.sectionCustomer')}</h3>
              <p className="text-foreground font-medium">{selectedAppointment.customer?.first_name} {selectedAppointment.customer?.last_name}</p>
              <p className="text-muted-foreground text-sm">{selectedAppointment.customer?.phone || tAdmin('appointments.noPhone')}</p>
              <p className="text-muted-foreground text-sm">{selectedAppointment.customer?.email || tAdmin('appointments.noEmail')}</p>
            </div>

            <div className="rounded-lg p-4 border border-border">
              <h3 className="text-sm font-semibold text-primary mb-2">{tAdmin('appointments.sectionLocation')}</h3>
              {selectedAppointment.location_type === 'home' ? (
                <div>
                  <p className="text-foreground/85 text-sm">{selectedAppointment.home_address || tAdmin('appointments.homeVisit')}</p>
                  {selectedAppointment.home_latitude && (
                    <p className="text-muted-foreground text-xs mt-1">
                      {selectedAppointment.home_latitude.toFixed(6)}, {selectedAppointment.home_longitude?.toFixed(6)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-foreground/85 text-sm">{selectedAppointment.salon?.name || tAdmin('appointments.locationSalon')} — {selectedAppointment.salon?.address || ''}</p>
              )}
            </div>

            <div className="rounded-lg p-4 border border-border">
              <h3 className="text-sm font-semibold text-primary mb-2">{tAdmin('appointments.sectionServices')}</h3>
              <div className="space-y-2">
                {selectedAppointment.services.map((s) => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span className="text-foreground/85">{s.name}</span>
                    <span className="text-muted-foreground">{s.duration_minutes} {tAdmin('services.minAbbr')} — {formatMoney(s.price_mad, lang)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 mt-2 flex justify-between text-sm font-semibold">
                  <span className="text-primary">{tAdmin('appointments.total')}</span>
                  <span className="text-primary">{formatMoney(selectedAppointment.total_price_mad, lang)}</span>
                </div>
                {selectedAppointment.location_type === 'home' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{tAdmin('appointments.homeVisitSurcharge')}</span>
                    <span className="text-muted-foreground">{formatMoney(Number(process.env.NEXT_PUBLIC_HOME_VISIT_SURCHARGE_MAD) || 30, lang)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg p-4 border border-border">
              <h3 className="text-sm font-semibold text-primary mb-2">{tAdmin('appointments.sectionProfessional')}</h3>
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
            </div>

            <div className="rounded-lg p-4 border border-border">
              <h3 className="text-sm font-semibold text-primary mb-2">{tAdmin('appointments.sectionPayment')}</h3>
              <p className="text-foreground/85 text-sm">{tAdmin(`appointments.paymentMethods.${selectedAppointment.payment_method}`)}</p>
            </div>

            {selectedAppointment.notes && (
              <div className="rounded-lg p-4 border border-border">
                <h3 className="text-sm font-semibold text-primary mb-2">{tAdmin('appointments.sectionNotes')}</h3>
                <p className="text-muted-foreground text-sm">{selectedAppointment.notes}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {selectedAppointment.status === 'pending' && (
                <Button
                  onClick={() => {
                    setAssigningAppointment(selectedAppointment);
                    setSelectedProfessionalId(selectedAppointment.preferred_professional_id || '');
                    setAssignModalOpen(true);
                  }}
                >
                  {tAdmin('appointments.assignProfessional')}
                </Button>
              )}
              {selectedAppointment.status === 'confirmed' && (
                <Button
                  onClick={() => handleStatusChange(selectedAppointment.id, 'completed')}
                  disabled={actionLoading === selectedAppointment.id}
                  className="bg-white hover:bg-neutral-200 text-black"
                >
                  {tAdmin('appointments.markCompleted')}
                </Button>
              )}
              {(selectedAppointment.status === 'pending' || selectedAppointment.status === 'confirmed') && (
                <Button
                  variant="destructive"
                  onClick={() => handleStatusChange(selectedAppointment.id, 'cancelled')}
                  disabled={actionLoading === selectedAppointment.id}
                >
                  {tAdmin('appointments.cancelAppointment')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

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
    </div>
  );
}