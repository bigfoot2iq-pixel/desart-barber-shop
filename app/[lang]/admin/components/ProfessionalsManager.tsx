'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Professional, Salon, Service, ProfessionalAvailability, AvailabilityOverride } from '@/lib/types/database';
import { getAllProfessionals, getAllSalons, getAllServices, createProfessional, updateProfessional, getProfessionalServices, setProfessionalServices } from '@/lib/queries';
import { getWeeklySchedule, setWeeklySchedule as saveWeeklyScheduleToDb, getOverrides, addOverride, deleteOverride } from '@/lib/queries/availability';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUploader } from '@/components/ui/image-uploader';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker, fmtTime } from '@/components/ui/time-picker';
import { Modal, AdminBadge, ToggleButton, useToast } from './ui';
import { formatDate, formatMoney } from '@/lib/i18n/format';
import { useT } from '@/lib/i18n/client-dictionary';
import type { Locale } from '@/lib/i18n/config';

type ProfessionalWithSalon = Professional & { salon: Salon | null };

interface ProfessionalsManagerProps {
  lang: Locale;
  initialProfessionals: ProfessionalWithSalon[];
  initialSalons: Salon[];
}

const dayOrder = [1, 2, 3, 4, 5, 6, 0];

const emptyForm = {
  display_name: '',
  phone: '',
  years_of_experience: 0,
  profession: 'barber',
  profile_image_url: '',
  offers_home_visit: false,
  is_active: true,
};

export default function ProfessionalsManager({ lang, initialProfessionals, initialSalons }: ProfessionalsManagerProps) {
  const tAdmin = useT('admin');
  const tCommon = useT('common');
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
    getAllServices(lang).then(setAllServices).catch(() => {});
  }, [lang]);

  useEffect(() => {
    if (initialProfessionals.length === 0) {
      refresh();
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [profs, slns] = await Promise.all([getAllProfessionals(lang), getAllSalons(lang)]);
      setProfessionals(profs);
      setSalons(slns);
    } catch {
      toast(tAdmin('professionals.toastRefreshFailed'), 'error');
    }
  }, [toast, tAdmin, lang]);

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
      offers_home_visit: p.offers_home_visit,
      is_active: p.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.display_name.trim()) errors.display_name = tAdmin('professionals.validationDisplayNameRequired');
    if (!form.phone.trim()) errors.phone = tAdmin('professionals.validationPhoneRequired');
    if (form.years_of_experience < 0) errors.years_of_experience = tAdmin('professionals.validationYearsNonNegative');
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
          offers_home_visit: form.offers_home_visit,
          is_active: form.is_active,
        });
        toast(tAdmin('professionals.toastUpdated'));
      } else {
        const res = await fetch('/api/professionals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: form.display_name,
            phone: form.phone,
            years_of_experience: form.years_of_experience,
            profession: form.profession,
            profile_image_url: form.profile_image_url || null,
            offers_home_visit: form.offers_home_visit,
            is_active: form.is_active,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create professional');
        }
        toast(tAdmin('professionals.toastCreated'));
      }
      setFormOpen(false);
      refresh();
    } catch (e) {
      toast(tAdmin('professionals.toastFailed', { error: e instanceof Error ? e.message : 'Unknown error' }), 'error');
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
      toast(tAdmin('professionals.toastServicesUpdated'));
      setServicesOpen(false);
    } catch {
      toast(tAdmin('professionals.toastServicesUpdateFailed'), 'error');
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
    setWeeklySchedule(schedule.map((s) => ({ ...s, start_time: fmtTime(s.start_time) || s.start_time, end_time: fmtTime(s.end_time) || s.end_time })));
    setOverrides(ovs.map((o) => ({ ...o, start_time: fmtTime(o.start_time) || o.start_time, end_time: fmtTime(o.end_time) || o.end_time })));
    setAvailabilityOpen(true);
  };

  const saveWeeklySchedule = async () => {
    if (!selectedProfessional) return;
    setLoading(true);
    try {
      await saveWeeklyScheduleToDb(selectedProfessional.id, weeklySchedule.map(({ id: _id, ...rest }) => rest));
      toast(tAdmin('professionals.toastScheduleSaved'));
    } catch {
      toast(tAdmin('professionals.toastScheduleSaveFailed'), 'error');
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
      toast(tAdmin('professionals.toastOverrideAdded'));
    } catch {
      toast(tAdmin('professionals.toastOverrideAddFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    try {
      await deleteOverride(id);
      setOverrides((prev) => prev.filter((o) => o.id !== id));
      toast(tAdmin('professionals.toastOverrideDeleted'));
    } catch {
      toast(tAdmin('professionals.toastOverrideDeleteFailed'), 'error');
    }
  };

  const toggleService = (serviceId: string) => {
    setProfessionalServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const dayLabels = [
    tAdmin('professionals.daySunday'),
    tAdmin('professionals.dayMonday'),
    tAdmin('professionals.dayTuesday'),
    tAdmin('professionals.dayWednesday'),
    tAdmin('professionals.dayThursday'),
    tAdmin('professionals.dayFriday'),
    tAdmin('professionals.daySaturday'),
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-playfair text-xl text-foreground font-semibold">{tAdmin('professionals.title')}</h2>
        <Button onClick={openAddForm}>{tAdmin('professionals.addProfessional')}</Button>
      </div>

      {professionals.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">{tAdmin('professionals.noProfessionals')}</p>
            <Button onClick={openAddForm}>{tAdmin('professionals.addFirst')}</Button>
          </CardContent>
        </Card>
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
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      {p.profile_image_url ? (
                        <img
                          src={p.profile_image_url}
                          alt={p.display_name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-1 ring-primary/20"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-playfair text-sm font-bold flex-shrink-0 ring-1 ring-primary/20">
                          {p.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-foreground font-medium truncate">{p.display_name}</h3>
                        <p className="text-muted-foreground text-xs">{p.phone}</p>
                      </div>
                      <AdminBadge variant={p.is_active ? 'active' : 'inactive'}>
                        {p.is_active ? tAdmin('professionals.active') : tAdmin('professionals.inactive')}
                      </AdminBadge>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground mb-3">
                      <p>{tAdmin('professionals.yearsExperience', { count: p.years_of_experience })}</p>
                      {p.offers_home_visit && <p className="text-neutral-400/80">{tAdmin('professionals.offersHomeVisits')}</p>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="xs" onClick={() => openEditForm(p)}>{tAdmin('professionals.edit')}</Button>
                      <Button variant="outline" size="xs" onClick={() => openServicesPanel(p)}>{tAdmin('professionals.services')}</Button>
                      <Button variant="outline" size="xs" onClick={() => openAvailabilityPanel(p)}>{tAdmin('professionals.availability')}</Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={async () => {
                          setActionId(p.id);
                          await updateProfessional(p.id, { is_active: !p.is_active });
                          toast(p.is_active ? tAdmin('professionals.toastDeactivated') : tAdmin('professionals.toastActivated'));
                          refresh();
                          setActionId(null);
                        }}
                        disabled={actionId === p.id}
                      >
                        {p.is_active ? tAdmin('professionals.deactivate') : tAdmin('professionals.activate')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingProfessional ? tAdmin('professionals.modalEditTitle') : tAdmin('professionals.modalAddTitle')}
      >
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('professionals.fieldDisplayName')}</Label>
            <Input
              type="text"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              className="mt-1"
            />
            {formErrors.display_name && <p className="text-red-400 text-xs mt-1">{formErrors.display_name}</p>}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('professionals.fieldPhone')}</Label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1"
            />
            {formErrors.phone && <p className="text-red-400 text-xs mt-1">{formErrors.phone}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('professionals.fieldYearsExperience')}</Label>
              <Input
                type="number"
                min={0}
                value={form.years_of_experience}
                onChange={(e) => setForm({ ...form, years_of_experience: parseInt(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('professionals.fieldProfession')}</Label>
              <Input
                type="text"
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <ImageUploader
              lang={lang}
              value={form.profile_image_url}
              onChange={(url) => setForm({ ...form, profile_image_url: url || '' })}
              folder="professionals"
              entityId={editingProfessional?.id}
              label={tAdmin('professionals.fieldProfileImageUrl')}
            />
          </div>

          <div className="flex items-center gap-6">
            <ToggleButton
              enabled={form.offers_home_visit}
              onChange={(v) => setForm({ ...form, offers_home_visit: v })}
              label={tAdmin('professionals.toggleOffersHomeVisits')}
            />
            <ToggleButton
              enabled={form.is_active}
              onChange={(v) => setForm({ ...form, is_active: v })}
              label={tAdmin('professionals.toggleActive')}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tCommon('cancel')}</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? tAdmin('professionals.saving') : editingProfessional ? tCommon('save') : tCommon('create')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={servicesOpen}
        onClose={() => setServicesOpen(false)}
        title={tAdmin('professionals.servicesModalTitle', { name: selectedProfessional?.display_name || '' })}
        maxWidth="sm:max-w-xl"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {allServices.map((s) => (
            <label key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:border-primary/30 transition-colors">
              <input
                type="checkbox"
                checked={professionalServiceIds.includes(s.id)}
                onChange={() => toggleService(s.id)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <div className="flex-1">
                <p className="text-foreground/85 text-sm font-medium">{s.name}</p>
                <p className="text-muted-foreground text-xs">{s.duration_minutes} {tAdmin('services.minAbbr')}</p>
              </div>
              <span className="text-primary text-sm font-semibold">{formatMoney(s.price_mad, lang)}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="outline" onClick={() => setServicesOpen(false)}>{tCommon('cancel')}</Button>
          <Button onClick={saveServices} disabled={loading}>
            {loading ? tAdmin('professionals.saving') : tAdmin('professionals.saveServices')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        title={tAdmin('professionals.availabilityModalTitle', { name: selectedProfessional?.display_name || '' })}
        maxWidth="sm:max-w-3xl"
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-sm text-primary font-semibold mb-3">{tAdmin('professionals.weeklySchedule')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {dayOrder.map((di) => {
                const day = dayLabels[di];
                const entry = weeklySchedule.find((s) => s.day_of_week === di);
                const isAvailable = entry?.is_available ?? false;
                return (
                  <div key={di} className="flex items-center gap-2 rounded-lg p-2.5 border border-border">
                    <span className={`text-sm font-medium shrink-0 ${di === 0 ? 'text-red-400' : 'text-foreground/85'}`}>{day}</span>
                    {isAvailable && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <TimePicker
                          value={entry?.start_time || '09:00'}
                          onChange={(v) => {
                            setWeeklySchedule((prev) => {
                              const existing = prev.find((s) => s.day_of_week === di);
                              if (existing) {
                                return prev.map((s) => s.day_of_week === di ? { ...s, start_time: v } : s);
                              }
                              return [...prev, { id: `temp-${di}`, professional_id: selectedProfessional?.id || '', day_of_week: di, start_time: v, end_time: '17:00', is_available: true }];
                            });
                          }}
                        />
                        <span className="text-muted-foreground">{tAdmin('appointments.timeRangeSeparator')}</span>
                        <TimePicker
                          value={entry?.end_time || '17:00'}
                          onChange={(v) => {
                            setWeeklySchedule((prev) => {
                              const existing = prev.find((s) => s.day_of_week === di);
                              if (existing) {
                                return prev.map((s) => s.day_of_week === di ? { ...s, end_time: v } : s);
                              }
                              return [...prev, { id: `temp-${di}`, professional_id: selectedProfessional?.id || '', day_of_week: di, start_time: '09:00', end_time: v, is_available: true }];
                            });
                          }}
                        />
                      </div>
                    )}
                    <div className="ml-auto shrink-0">
                      <ToggleButton
                        enabled={isAvailable}
                        onChange={(v) => {
                          setWeeklySchedule((prev) => {
                            const existing = prev.find((s) => s.day_of_week === di);
                            if (existing) {
                              return prev.map((s) => s.day_of_week === di ? { ...s, is_available: v } : s);
                            }
                            return [...prev, { id: `temp-${di}`, professional_id: selectedProfessional?.id || '', day_of_week: di, start_time: '09:00', end_time: '17:00', is_available: v }];
                          });
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-center rounded-lg">
                <Button onClick={saveWeeklySchedule} disabled={loading}>
                  {loading ? tAdmin('professionals.saving') : tAdmin('professionals.saveWeeklySchedule')}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm text-primary font-semibold mb-3">{tAdmin('professionals.holidaysTimeOff')}</h3>

            {overrides.length > 0 && (
              <div className="space-y-2 mb-4">
                {overrides.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg p-3 border border-border">
                    <div>
                      <p className="text-foreground/85 text-sm">{formatDate(new Date(o.override_date + 'T00:00:00'), lang)}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.is_available ? `${fmtTime(o.start_time)} ${tAdmin('appointments.timeRangeSeparator')} ${fmtTime(o.end_time)}` : tAdmin('professionals.unavailable')}
                        {o.reason && ` — ${o.reason}`}
                      </p>
                    </div>
                    <button onClick={() => handleDeleteOverride(o.id)} className="text-red-400 text-xs hover:text-red-300 transition-colors">{tAdmin('professionals.delete')}</button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg p-4 border border-border space-y-3">
              <h4 className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('professionals.addOverride')}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('professionals.fieldDate')}</Label>
                  <div className="mt-1">
                    <DatePicker
                      value={overrideForm.override_date}
                      onChange={(v) => setOverrideForm({ ...overrideForm, override_date: v })}
                      minDate={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('professionals.fieldAvailable')}</Label>
                  <div className="mt-2">
                    <ToggleButton
                      enabled={overrideForm.is_available}
                      onChange={(v) => setOverrideForm({ ...overrideForm, is_available: v })}
                    />
                  </div>
                </div>
              </div>
              {overrideForm.is_available && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('professionals.fieldStartTime')}</Label>
                    <div className="mt-1">
                      <TimePicker
                        value={overrideForm.start_time}
                        onChange={(v) => setOverrideForm({ ...overrideForm, start_time: v })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('professionals.fieldEndTime')}</Label>
                    <div className="mt-1">
                      <TimePicker
                        value={overrideForm.end_time}
                        onChange={(v) => setOverrideForm({ ...overrideForm, end_time: v })}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('professionals.fieldReasonOptional')}</Label>
                <Input
                  type="text"
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  className="mt-1"
                  placeholder={tAdmin('professionals.fieldReasonPlaceholder')}
                />
              </div>
              <Button onClick={handleSaveOverride} disabled={loading || !overrideForm.override_date}>
                {tAdmin('professionals.addOverride')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}