'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Professional, Salon, Service, ProfessionalAvailability, AvailabilityOverride } from '@/lib/types/database';
import { getAllProfessionals, getAllSalons, getAllServices, createProfessional, updateProfessional, getProfessionalServices, setProfessionalServices } from '@/lib/queries';
import { getWeeklySchedule, setWeeklySchedule as saveWeeklyScheduleToDb, getOverrides, addOverride, deleteOverride } from '@/lib/queries/availability';
import { createProfile } from '@/lib/queries/appointments';
import { Modal, Badge, ToggleButton, useToast } from './ui';

type ProfessionalWithSalon = Professional & { salon: Salon | null };

interface ProfessionalsManagerProps {
  initialProfessionals: ProfessionalWithSalon[];
  initialSalons: Salon[];
}

const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const emptyForm = {
  display_name: '',
  phone: '',
  years_of_experience: 0,
  profession: 'barber',
  profile_image_url: '',
  salon_id: '',
  offers_home_visit: false,
  is_active: true,
};

export default function ProfessionalsManager({ initialProfessionals, initialSalons }: ProfessionalsManagerProps) {
  const [professionals, setProfessionals] = useState<ProfessionalWithSalon[]>(initialProfessionals);
  const [salons, setSalons] = useState<Salon[]>(initialSalons);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<ProfessionalWithSalon | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [selectedProfessional, setSelectedProfessional] = useState<ProfessionalWithSalon | null>(null);
  const [professionalServiceIds, setProfessionalServiceIds] = useState<string[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<ProfessionalAvailability[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [overrideForm, setOverrideForm] = useState({ override_date: '', start_time: '09:00', end_time: '17:00', is_available: false, reason: '' });
  const { toast } = useToast();

  useEffect(() => {
    getAllServices().then(setAllServices).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [profs, slns] = await Promise.all([getAllProfessionals(), getAllSalons()]);
      setProfessionals(profs);
      setSalons(slns);
    } catch {
      toast('Failed to refresh', 'error');
    }
  }, [toast]);

  const openAddForm = () => {
    setEditingProfessional(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (p: ProfessionalWithSalon) => {
    setEditingProfessional(p);
    setForm({
      display_name: p.display_name,
      phone: p.phone,
      years_of_experience: p.years_of_experience,
      profession: p.profession,
      profile_image_url: p.profile_image_url || '',
      salon_id: p.salon_id || '',
      offers_home_visit: p.offers_home_visit,
      is_active: p.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.display_name.trim()) errors.display_name = 'Display name is required';
    if (!form.phone.trim()) errors.phone = 'Phone is required';
    if (form.years_of_experience < 0) errors.years_of_experience = 'Must be 0 or more';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (editingProfessional) {
        await updateProfessional(editingProfessional.id, {
          display_name: form.display_name,
          phone: form.phone,
          years_of_experience: form.years_of_experience,
          profession: form.profession,
          profile_image_url: form.profile_image_url || null,
          salon_id: form.salon_id || undefined,
          offers_home_visit: form.offers_home_visit,
          is_active: form.is_active,
        });
        toast('Professional updated');
      } else {
        const profile = await createProfile({
          id: crypto.randomUUID(),
          role: 'professional',
          first_name: form.display_name,
          last_name: '',
          phone: form.phone,
          email: null,
        });
        await createProfessional({
          id: profile.id,
          salon_id: form.salon_id || '',
          display_name: form.display_name,
          phone: form.phone,
          years_of_experience: form.years_of_experience,
          profession: form.profession,
          profile_image_url: form.profile_image_url || null,
          offers_home_visit: form.offers_home_visit,
          is_active: form.is_active,
        });
        toast('Professional created');
      }
      setFormOpen(false);
      refresh();
    } catch (e) {
      toast('Failed: ' + (e instanceof Error ? e.message : 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const openServicesPanel = async (p: ProfessionalWithSalon) => {
    setSelectedProfessional(p);
    const ids = await getProfessionalServices(p.id);
    setProfessionalServiceIds(ids);
    setServicesOpen(true);
  };

  const saveServices = async () => {
    if (!selectedProfessional) return;
    setLoading(true);
    try {
      await setProfessionalServices(selectedProfessional.id, professionalServiceIds);
      toast('Services updated');
      setServicesOpen(false);
    } catch {
      toast('Failed to update services', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAvailabilityPanel = async (p: ProfessionalWithSalon) => {
    setSelectedProfessional(p);
    const [schedule, ovs] = await Promise.all([
      getWeeklySchedule(p.id),
      getOverrides(p.id, new Date().toISOString().split('T')[0], new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]),
    ]);
    setWeeklySchedule(schedule);
    setOverrides(ovs);
    setAvailabilityOpen(true);
  };

  const saveWeeklySchedule = async () => {
    if (!selectedProfessional) return;
    setLoading(true);
    try {
      await saveWeeklyScheduleToDb(selectedProfessional.id, weeklySchedule.map(({ id: _id, ...rest }) => rest));
      toast('Weekly schedule saved');
    } catch {
      toast('Failed to save schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!selectedProfessional || !overrideForm.override_date) return;
    setLoading(true);
    try {
      const ov = await addOverride({
        professional_id: selectedProfessional.id,
        override_date: overrideForm.override_date,
        is_available: overrideForm.is_available,
        start_time: overrideForm.is_available ? overrideForm.start_time : null,
        end_time: overrideForm.is_available ? overrideForm.end_time : null,
        reason: overrideForm.reason || null,
      });
      setOverrides((prev) => [...prev, ov].sort((a, b) => a.override_date.localeCompare(b.override_date)));
      setOverrideForm({ override_date: '', start_time: '09:00', end_time: '17:00', is_available: false, reason: '' });
      toast('Override added');
    } catch {
      toast('Failed to add override', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    try {
      await deleteOverride(id);
      setOverrides((prev) => prev.filter((o) => o.id !== id));
      toast('Override deleted');
    } catch {
      toast('Failed to delete override', 'error');
    }
  };

  const toggleService = (serviceId: string) => {
    setProfessionalServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-playfair text-xl text-cream font-semibold">Professionals</h2>
        <button onClick={openAddForm} className="admin-btn-primary">+ Add Professional</button>
      </div>

      {professionals.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <p className="text-cream/45 mb-4">No professionals yet</p>
          <button onClick={openAddForm} className="admin-btn-primary">Add Professional</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {professionals.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="admin-card p-4"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center text-gold3 font-playfair text-sm font-bold flex-shrink-0 ring-1 ring-gold/20">
                    {p.display_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-cream font-medium truncate">{p.display_name}</h3>
                    <p className="text-cream/55 text-xs">{p.phone}</p>
                  </div>
                  <Badge variant={p.is_active ? 'active' : 'inactive'}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-cream/55 mb-3">
                  <p>{p.years_of_experience} years experience</p>
                  <p>{p.salon?.name || 'No salon'}</p>
                  {p.offers_home_visit && <p className="text-emerald-400/80">Offers home visits</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openEditForm(p)} className="admin-btn-outline text-xs px-3 py-1">Edit</button>
                  <button onClick={() => openServicesPanel(p)} className="admin-btn-outline text-xs px-3 py-1">Services</button>
                  <button onClick={() => openAvailabilityPanel(p)} className="admin-btn-outline text-xs px-3 py-1">Availability</button>
                  <button
                    onClick={async () => {
                      setActionId(p.id);
                      await updateProfessional(p.id, { is_active: !p.is_active });
                      toast(p.is_active ? 'Deactivated' : 'Activated');
                      refresh();
                      setActionId(null);
                    }}
                    disabled={actionId === p.id}
                    className="admin-btn-outline text-xs px-3 py-1 disabled:opacity-50"
                  >
                    {p.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingProfessional ? 'Edit Professional' : 'Add Professional'}
      >
        <div className="space-y-4">
          <div>
            <label className="admin-section-label">Display Name *</label>
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              className="admin-input w-full"
            />
            {formErrors.display_name && <p className="text-red-400 text-xs mt-1">{formErrors.display_name}</p>}
          </div>

          <div>
            <label className="admin-section-label">Phone *</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="admin-input w-full"
            />
            {formErrors.phone && <p className="text-red-400 text-xs mt-1">{formErrors.phone}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="admin-section-label">Years of Experience</label>
              <input
                type="number"
                min={0}
                value={form.years_of_experience}
                onChange={(e) => setForm({ ...form, years_of_experience: parseInt(e.target.value) || 0 })}
                className="admin-input w-full"
              />
            </div>
            <div>
              <label className="admin-section-label">Profession</label>
              <input
                type="text"
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
                className="admin-input w-full"
              />
            </div>
          </div>

          <div>
            <label className="admin-section-label">Profile Image URL</label>
            <input
              type="url"
              value={form.profile_image_url}
              onChange={(e) => setForm({ ...form, profile_image_url: e.target.value })}
              className="admin-input w-full"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="admin-section-label">Salon</label>
            <select
              value={form.salon_id}
              onChange={(e) => setForm({ ...form, salon_id: e.target.value })}
              className="admin-input w-full"
            >
              <option value="">No salon</option>
              {salons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-6">
            <ToggleButton
              enabled={form.offers_home_visit}
              onChange={(v) => setForm({ ...form, offers_home_visit: v })}
              label="Offers Home Visits"
            />
            <ToggleButton
              enabled={form.is_active}
              onChange={(v) => setForm({ ...form, is_active: v })}
              label="Active"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setFormOpen(false)} className="admin-btn-outline">Cancel</button>
            <button onClick={handleSubmit} disabled={loading} className="admin-btn-primary disabled:opacity-50">
              {loading ? 'Saving...' : editingProfessional ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={servicesOpen}
        onClose={() => setServicesOpen(false)}
        title={`Services — ${selectedProfessional?.display_name}`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto admin-scroll">
          {allServices.map((s) => (
            <label key={s.id} className="flex items-center gap-3 p-3 bg-brand-black/40 rounded-lg border border-gold/12 cursor-pointer hover:border-gold/25 transition-colors">
              <input
                type="checkbox"
                checked={professionalServiceIds.includes(s.id)}
                onChange={() => toggleService(s.id)}
                className="w-4 h-4 rounded border-gold/30 bg-brand-black accent-gold"
              />
              <div className="flex-1">
                <p className="text-cream/85 text-sm font-medium">{s.name}</p>
                <p className="text-cream/50 text-xs">{s.duration_minutes} min</p>
              </div>
              <span className="text-gold3 text-sm font-semibold">{s.price_mad} MAD</span>
            </label>
          ))}
        </div>
        <div className="flex gap-3 justify-end pt-4">
          <button onClick={() => setServicesOpen(false)} className="admin-btn-outline">Cancel</button>
          <button onClick={saveServices} disabled={loading} className="admin-btn-primary disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Services'}
          </button>
        </div>
      </Modal>

      <Modal
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        title={`Availability — ${selectedProfessional?.display_name}`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-sm text-gold3 font-semibold mb-3">Weekly Schedule</h3>
            <div className="space-y-2">
              {dayLabels.map((day, i) => {
                const entry = weeklySchedule.find((s) => s.day_of_week === i);
                const isAvailable = entry?.is_available ?? i !== 5;
                return (
                  <div key={i} className="flex items-center gap-3 bg-brand-black/40 rounded-lg p-3 border border-gold/12">
                    <span className={`w-20 text-sm ${i === 5 ? 'text-red-400' : 'text-cream/85'}`}>{day}</span>
                    <ToggleButton
                      enabled={isAvailable}
                      onChange={(v) => {
                        setWeeklySchedule((prev) => {
                          const existing = prev.find((s) => s.day_of_week === i);
                          if (existing) {
                            return prev.map((s) => s.day_of_week === i ? { ...s, is_available: v } : s);
                          }
                          return [...prev, { id: `temp-${i}`, professional_id: selectedProfessional?.id || '', day_of_week: i, start_time: '09:00', end_time: '17:00', is_available: v }];
                        });
                      }}
                    />
                    {isAvailable && (
                      <div className="flex items-center gap-2 text-sm">
                        <input
                          type="time"
                          value={entry?.start_time || '09:00'}
                          onChange={(e) => {
                            setWeeklySchedule((prev) => {
                              const existing = prev.find((s) => s.day_of_week === i);
                              if (existing) {
                                return prev.map((s) => s.day_of_week === i ? { ...s, start_time: e.target.value } : s);
                              }
                              return [...prev, { id: `temp-${i}`, professional_id: selectedProfessional?.id || '', day_of_week: i, start_time: e.target.value, end_time: '17:00', is_available: true }];
                            });
                          }}
                          className="admin-input text-xs px-2 py-1"
                        />
                        <span className="text-cream/45">to</span>
                        <input
                          type="time"
                          value={entry?.end_time || '17:00'}
                          onChange={(e) => {
                            setWeeklySchedule((prev) => {
                              const existing = prev.find((s) => s.day_of_week === i);
                              if (existing) {
                                return prev.map((s) => s.day_of_week === i ? { ...s, end_time: e.target.value } : s);
                              }
                              return [...prev, { id: `temp-${i}`, professional_id: selectedProfessional?.id || '', day_of_week: i, start_time: '09:00', end_time: e.target.value, is_available: true }];
                            });
                          }}
                          className="admin-input text-xs px-2 py-1"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={saveWeeklySchedule} disabled={loading} className="mt-3 admin-btn-primary disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Weekly Schedule'}
            </button>
          </div>

          <div>
            <h3 className="text-sm text-gold3 font-semibold mb-3">Date Overrides</h3>

            {overrides.length > 0 && (
              <div className="space-y-2 mb-4">
                {overrides.map((o) => (
                  <div key={o.id} className="flex items-center justify-between bg-brand-black/40 rounded-lg p-3 border border-gold/12">
                    <div>
                      <p className="text-cream/85 text-sm">{o.override_date}</p>
                      <p className="text-xs text-cream/50">
                        {o.is_available ? `${o.start_time} - ${o.end_time}` : 'Unavailable'}
                        {o.reason && ` — ${o.reason}`}
                      </p>
                    </div>
                    <button onClick={() => handleDeleteOverride(o.id)} className="text-red-400 text-xs hover:text-red-300 transition-colors">Delete</button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-brand-black/40 rounded-lg p-4 border border-gold/12 space-y-3">
              <h4 className="text-[11px] text-cream/55 uppercase tracking-wider font-semibold">Add Override</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="admin-section-label">Date</label>
                  <input
                    type="date"
                    value={overrideForm.override_date}
                    onChange={(e) => setOverrideForm({ ...overrideForm, override_date: e.target.value })}
                    className="admin-input"
                  />
                </div>
                <div>
                  <label className="admin-section-label">Available?</label>
                  <ToggleButton
                    enabled={overrideForm.is_available}
                    onChange={(v) => setOverrideForm({ ...overrideForm, is_available: v })}
                  />
                </div>
              </div>
              {overrideForm.is_available && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="admin-section-label">Start Time</label>
                    <input
                      type="time"
                      value={overrideForm.start_time}
                      onChange={(e) => setOverrideForm({ ...overrideForm, start_time: e.target.value })}
                      className="admin-input"
                    />
                  </div>
                  <div>
                    <label className="admin-section-label">End Time</label>
                    <input
                      type="time"
                      value={overrideForm.end_time}
                      onChange={(e) => setOverrideForm({ ...overrideForm, end_time: e.target.value })}
                      className="admin-input"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="admin-section-label">Reason (optional)</label>
                <input
                  type="text"
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  className="admin-input"
                  placeholder="Holiday, sick leave..."
                />
              </div>
              <button onClick={handleSaveOverride} disabled={loading || !overrideForm.override_date} className="admin-btn-primary disabled:opacity-50">
                Add Override
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}