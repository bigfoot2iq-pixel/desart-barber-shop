'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Service } from '@/lib/types/database';
import type { Locale } from '@/lib/i18n/config';
import { getAllServices, createService, updateService } from '@/lib/queries';
import { formatMoney } from '@/lib/i18n/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Modal, ToggleButton, useToast } from './ui';
import { useT } from '@/lib/i18n/client-dictionary';

interface ServicesManagerProps {
  lang: Locale;
  initialServices: Service[];
}

const emptyForm = {
  name: '',
  description: '',
  duration_minutes: 30,
  price_mad: 0,
  is_active: true,
};

export default function ServicesManager({ lang, initialServices }: ServicesManagerProps) {
  const tAdmin = useT('admin');
  const tCommon = useT('common');
  const [services, setServices] = useState<Service[]>(initialServices);
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const data = await getAllServices();
      setServices(data);
    } catch {
      toast(tAdmin('services.toastRefreshFailed'), 'error');
    }
  }, [toast, tAdmin]);

  const openAddForm = () => {
    setEditingService(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (s: Service) => {
    setEditingService(s);
    setForm({
      name: s.name,
      description: s.description || '',
      duration_minutes: s.duration_minutes,
      price_mad: s.price_mad,
      is_active: s.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = tAdmin('services.validationNameRequired');
    if (form.duration_minutes <= 0) errors.duration_minutes = tAdmin('services.validationDurationPositive');
    if (form.price_mad < 0) errors.price_mad = tAdmin('services.validationPriceNonNegative');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (editingService) {
        await updateService(editingService.id, {
          name: form.name,
          description: form.description || null,
          duration_minutes: form.duration_minutes,
          price_mad: form.price_mad,
          is_active: form.is_active,
        });
        toast(tAdmin('services.toastUpdated'));
      } else {
        await createService({
          name: form.name,
          description: form.description || null,
          duration_minutes: form.duration_minutes,
          price_mad: form.price_mad,
          is_active: form.is_active,
        });
        toast(tAdmin('services.toastCreated'));
      }
      setFormOpen(false);
      refresh();
    } catch (e) {
      toast(tAdmin('services.toastFailed', { error: e instanceof Error ? e.message : 'Unknown error' }), 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (s: Service) => {
    try {
      await updateService(s.id, { is_active: !s.is_active });
      toast(s.is_active ? tAdmin('services.toastDeactivated') : tAdmin('services.toastActivated'));
      refresh();
    } catch {
      toast(tAdmin('services.toastToggleFailed'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-playfair text-xl text-foreground font-semibold">{tAdmin('services.title')}</h2>
        <Button onClick={openAddForm}>{tAdmin('services.addService')}</Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">{tAdmin('services.noServices')}</p>
            <Button onClick={openAddForm}>{tAdmin('services.addFirst')}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {services.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-foreground font-medium truncate">{s.name}</h3>
                          {!s.is_active && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400 border border-zinc-500/30 font-medium">{tAdmin('services.inactive')}</span>
                          )}
                        </div>
                        {s.description && (
                          <p className="text-muted-foreground text-sm line-clamp-1">{s.description}</p>
                        )}
                      </div>
                      <div className="hidden sm:flex items-center gap-6 text-sm flex-shrink-0">
                        <span className="text-muted-foreground">{s.duration_minutes} {tAdmin('services.minAbbr')}</span>
                        <span className="text-primary font-semibold">{formatMoney(s.price_mad, lang)}</span>
                        <ToggleButton
                          enabled={s.is_active}
                          onChange={() => toggleActive(s)}
                        />
                        <Button variant="outline" size="xs" onClick={() => openEditForm(s)}>{tAdmin('services.edit')}</Button>
                      </div>
                      <div className="flex sm:hidden items-center gap-2">
                        <span className="text-primary font-semibold text-sm">{formatMoney(s.price_mad, lang)}</span>
                        <button onClick={() => openEditForm(s)} className="text-primary text-xs font-medium">{tAdmin('services.edit')}</button>
                      </div>
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
        title={editingService ? tAdmin('services.modalEditTitle') : tAdmin('services.modalAddTitle')}
      >
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('services.fieldName')}</Label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1"
            />
            {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('services.fieldDescription')}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('services.fieldDuration')}</Label>
              <Input
                type="number"
                min={1}
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })}
                className="mt-1"
              />
              {formErrors.duration_minutes && <p className="text-red-400 text-xs mt-1">{formErrors.duration_minutes}</p>}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('services.fieldPrice')}</Label>
              <Input
                type="number"
                min={0}
                value={form.price_mad}
                onChange={(e) => setForm({ ...form, price_mad: parseFloat(e.target.value) || 0 })}
                className="mt-1"
              />
              {formErrors.price_mad && <p className="text-red-400 text-xs mt-1">{formErrors.price_mad}</p>}
            </div>
          </div>

          <ToggleButton
            enabled={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
            label={tAdmin('services.toggleActive')}
          />

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tCommon('cancel')}</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? tCommon('loading') : editingService ? tCommon('save') : tCommon('create')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}