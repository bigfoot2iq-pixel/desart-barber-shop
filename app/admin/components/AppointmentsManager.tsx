'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppointmentWithDetails, Professional, AppointmentStatus } from '@/lib/types/database';
import { getAllAppointments, assignProfessionalToAppointment, updateAppointmentStatus, getActiveProfessionals, searchAppointments } from '@/lib/queries';
import { Modal, Badge, useToast } from './ui';

type StatusFilter = 'all' | AppointmentStatus;

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusBadgeVariants: Record<string, 'pending' | 'confirmed' | 'completed' | 'cancelled'> = {
  pending: 'pending',
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
};

interface AppointmentsManagerProps {
  initialAppointments: AppointmentWithDetails[];
}

export default function AppointmentsManager({ initialAppointments }: AppointmentsManagerProps) {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>(initialAppointments);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningAppointment, setAssigningAppointment] = useState<AppointmentWithDetails | null>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    getActiveProfessionals().then(setProfessionals).catch(() => {});
  }, []);

  const refreshAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllAppointments(statusFilter === 'all' ? undefined : statusFilter);
      setAppointments(data);
    } catch {
      toast('Failed to load appointments', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    refreshAppointments();
  }, [refreshAppointments]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery && !dateFrom && !dateTo) {
      refreshAppointments();
      return;
    }
    setLoading(true);
    try {
      const data = await searchAppointments(searchQuery, statusFilter === 'all' ? undefined : statusFilter);
      let filtered = data;
      if (dateFrom) filtered = filtered.filter((a) => a.appointment_date >= dateFrom);
      if (dateTo) filtered = filtered.filter((a) => a.appointment_date <= dateTo);
      setAppointments(filtered);
    } catch {
      toast('Search failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, dateFrom, dateTo, statusFilter, toast, refreshAppointments]);

  const handleAssign = async () => {
    if (!assigningAppointment || !selectedProfessionalId) return;
    setActionLoading(assigningAppointment.id);
    try {
      await assignProfessionalToAppointment(assigningAppointment.id, selectedProfessionalId);
      toast('Professional assigned & appointment confirmed');
      setAssignModalOpen(false);
      setSelectedProfessionalId('');
      setAssigningAppointment(null);
      refreshAppointments();
    } catch {
      toast('Failed to assign professional', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    setActionLoading(appointmentId);
    try {
      await updateAppointmentStatus(appointmentId, newStatus);
      toast(`Appointment ${statusLabels[newStatus]?.toLowerCase()}`);
      refreshAppointments();
      if (selectedAppointment?.id === appointmentId) {
        setSelectedAppointment({ ...selectedAppointment, status: newStatus });
      }
    } catch {
      toast('Failed to update status', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = appointments.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (dateFrom && a.appointment_date < dateFrom) return false;
    if (dateTo && a.appointment_date > dateTo) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = `${a.customer?.first_name ?? ''} ${a.customer?.last_name ?? ''}`.toLowerCase();
      const phone = a.customer?.phone?.toLowerCase() ?? '';
      if (!name.includes(q) && !phone.includes(q)) return false;
    }
    return true;
  });

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const formatDate = (date: string) => {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="admin-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="admin-section-label">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Customer name or phone..."
              className="admin-input w-full"
            />
          </div>
          <div>
            <label className="admin-section-label">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="admin-input"
            />
          </div>
          <div>
            <label className="admin-section-label">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="admin-input"
            />
          </div>
          <button onClick={handleSearch} className="admin-btn-primary">Search</button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              statusFilter === s
                ? 'bg-gold text-brand-black shadow-sm'
                : 'bg-admin-surface text-cream/55 hover:text-cream border border-gold/18 hover:border-gold/30'
            }`}
          >
            {s === 'all' ? 'All' : statusLabels[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-card p-4 animate-pulse">
              <div className="h-4 bg-gold/8 rounded w-1/4 mb-3" />
              <div className="h-3 bg-gold/6 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <p className="text-cream/45 mb-4">No appointments found</p>
        </div>
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
                className="admin-card"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setSelectedAppointment(apt)}
                >
                  <div className="flex flex-wrap items-center gap-2 md:hidden mb-2">
                    <span className="text-cream font-medium text-sm">{formatDate(apt.appointment_date)}</span>
                    <span className="text-cream/55 text-sm">{formatTime(apt.start_time)} - {formatTime(apt.end_time)}</span>
                    <Badge variant={statusBadgeVariants[apt.status]}>{statusLabels[apt.status]}</Badge>
                  </div>
                  <p className="text-cream font-medium md:hidden">
                    {apt.customer?.first_name} {apt.customer?.last_name}
                  </p>
                  <p className="text-cream/50 text-xs md:hidden">
                    {apt.services.map((s) => s.name).join(', ')}
                  </p>

                  <div className="hidden md:grid grid-cols-[100px_120px_1fr_1fr_1fr_80px_100px_80px] gap-3 items-center text-sm">
                    <span className="text-cream/85">{formatDate(apt.appointment_date)}</span>
                    <span className="text-cream/55">{formatTime(apt.start_time)}</span>
                    <span className="text-cream font-medium truncate">{apt.customer?.first_name} {apt.customer?.last_name}</span>
                    <span className="text-cream/50 truncate">{apt.preferred_professional?.display_name || 'Any'}</span>
                    <span className="text-cream/50 truncate">{apt.professional?.display_name || '—'}</span>
                    <span className="text-gold3 font-semibold">{apt.total_price_mad} MAD</span>
                    <Badge variant={statusBadgeVariants[apt.status]}>{statusLabels[apt.status]}</Badge>
                    <span className="text-cream/45 truncate text-xs">{apt.location_type === 'home' ? 'Home' : apt.salon?.name || 'Salon'}</span>
                  </div>

                  {apt.status === 'pending' && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssigningAppointment(apt);
                          setSelectedProfessionalId(apt.preferred_professional_id || '');
                          setAssignModalOpen(true);
                        }}
                        className="admin-btn-primary text-xs"
                      >
                        Assign Professional
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Modal
        open={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        title="Appointment Details"
        maxWidth="max-w-2xl"
      >
        {selectedAppointment && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Badge variant={statusBadgeVariants[selectedAppointment.status]}>
                {statusLabels[selectedAppointment.status]}
              </Badge>
              <span className="text-cream/55 text-sm">
                {formatDate(selectedAppointment.appointment_date)} at {formatTime(selectedAppointment.start_time)} - {formatTime(selectedAppointment.end_time)}
              </span>
            </div>

            <div className="bg-brand-black/40 rounded-lg p-4 border border-gold/12">
              <h3 className="text-sm font-semibold text-gold3 mb-2">Customer</h3>
              <p className="text-cream font-medium">{selectedAppointment.customer?.first_name} {selectedAppointment.customer?.last_name}</p>
              <p className="text-cream/55 text-sm">{selectedAppointment.customer?.phone || 'No phone'}</p>
              <p className="text-cream/55 text-sm">{selectedAppointment.customer?.email || 'No email'}</p>
            </div>

            <div className="bg-brand-black/40 rounded-lg p-4 border border-gold/12">
              <h3 className="text-sm font-semibold text-gold3 mb-2">Location</h3>
              {selectedAppointment.location_type === 'home' ? (
                <div>
                  <p className="text-cream/85 text-sm">{selectedAppointment.home_address || 'Home visit'}</p>
                  {selectedAppointment.home_latitude && (
                    <p className="text-cream/45 text-xs mt-1">
                      {selectedAppointment.home_latitude.toFixed(6)}, {selectedAppointment.home_longitude?.toFixed(6)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-cream/85 text-sm">{selectedAppointment.salon?.name || 'Salon'} — {selectedAppointment.salon?.address || ''}</p>
              )}
            </div>

            <div className="bg-brand-black/40 rounded-lg p-4 border border-gold/12">
              <h3 className="text-sm font-semibold text-gold3 mb-2">Services</h3>
              <div className="space-y-2">
                {selectedAppointment.services.map((s) => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span className="text-cream/85">{s.name}</span>
                    <span className="text-cream/50">{s.duration_minutes} min — {s.price_mad} MAD</span>
                  </div>
                ))}
                <div className="border-t border-gold/12 pt-2 mt-2 flex justify-between text-sm font-semibold">
                  <span className="text-gold3">Total</span>
                  <span className="text-gold3">{selectedAppointment.total_price_mad} MAD</span>
                </div>
                {selectedAppointment.location_type === 'home' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-cream/50">Home visit surcharge</span>
                    <span className="text-cream/50">{process.env.NEXT_PUBLIC_HOME_VISIT_SURCHARGE_MAD || '30'} MAD</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-brand-black/40 rounded-lg p-4 border border-gold/12">
              <h3 className="text-sm font-semibold text-gold3 mb-2">Professional</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-cream/50">Preferred</span>
                  <span className="text-cream/85">{selectedAppointment.preferred_professional?.display_name || 'Any available'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cream/50">Assigned</span>
                  <span className="text-cream/85">{selectedAppointment.professional?.display_name || 'Not assigned'}</span>
                </div>
              </div>
            </div>

            <div className="bg-brand-black/40 rounded-lg p-4 border border-gold/12">
              <h3 className="text-sm font-semibold text-gold3 mb-2">Payment</h3>
              <p className="text-cream/85 text-sm capitalize">{selectedAppointment.payment_method?.replace('_', ' ')}</p>
            </div>

            {selectedAppointment.notes && (
              <div className="bg-brand-black/40 rounded-lg p-4 border border-gold/12">
                <h3 className="text-sm font-semibold text-gold3 mb-2">Notes</h3>
                <p className="text-cream/65 text-sm">{selectedAppointment.notes}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {selectedAppointment.status === 'pending' && (
                <button
                  onClick={() => {
                    setAssigningAppointment(selectedAppointment);
                    setSelectedProfessionalId(selectedAppointment.preferred_professional_id || '');
                    setAssignModalOpen(true);
                  }}
                  className="admin-btn-primary"
                >
                  Assign Professional
                </button>
              )}
              {selectedAppointment.status === 'confirmed' && (
                <button
                  onClick={() => handleStatusChange(selectedAppointment.id, 'completed')}
                  disabled={actionLoading === selectedAppointment.id}
                  className="bg-emerald-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50"
                >
                  Mark Completed
                </button>
              )}
              {(selectedAppointment.status === 'pending' || selectedAppointment.status === 'confirmed') && (
                <button
                  onClick={() => handleStatusChange(selectedAppointment.id, 'cancelled')}
                  disabled={actionLoading === selectedAppointment.id}
                  className="bg-red-500/15 text-red-400 border border-red-500/30 font-semibold px-4 py-2 rounded-lg hover:bg-red-500/25 transition-colors text-sm disabled:opacity-50"
                >
                  Cancel Appointment
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={assignModalOpen}
        onClose={() => { setAssignModalOpen(false); setSelectedProfessionalId(''); setAssigningAppointment(null); }}
        title="Assign Professional"
      >
        <div className="space-y-4">
          {assigningAppointment?.preferred_professional && (
            <div className="bg-gold/8 border border-gold/25 rounded-lg p-3">
              <p className="text-xs text-gold3 mb-1 font-medium">Customer preferred:</p>
              <p className="text-cream font-medium">{assigningAppointment.preferred_professional.display_name}</p>
            </div>
          )}

          <div>
            <label className="admin-section-label">Select Professional</label>
            <select
              value={selectedProfessionalId}
              onChange={(e) => setSelectedProfessionalId(e.target.value)}
              className="admin-input w-full"
            >
              <option value="">— Choose a professional —</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} (at {p.salon_id ? 'Salon' : 'No salon'})
                  {p.id === assigningAppointment?.preferred_professional_id ? ' ★ Preferred' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => { setAssignModalOpen(false); setSelectedProfessionalId(''); setAssigningAppointment(null); }} className="admin-btn-outline">
              Cancel
            </button>
            <button onClick={handleAssign} disabled={!selectedProfessionalId || actionLoading !== null} className="admin-btn-primary disabled:opacity-50">
              {actionLoading ? 'Assigning...' : 'Assign & Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}