'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Service } from '@/lib/types/database';
import { getAllServices, createService, updateService } from '@/lib/queries';
import { Modal, ToggleButton, useToast } from './ui';

interface ServicesManagerProps {
  initialServices: Service[];
}

const emptyForm = {
  name: '',
  description: '',
  duration_minutes: 30,
  price_mad: 0,
  is_active: true,
};

export default function ServicesManager({ initialServices }: ServicesManagerProps) {
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
      toast('Failed to refresh services', 'error');
    }
  }, [toast]);

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
    if (!form.name.trim()) errors.name = 'Name is required';
    if (form.duration_minutes <= 0) errors.duration_minutes = 'Must be greater than 0';
    if (form.price_mad < 0) errors.price_mad = 'Must be 0 or more';
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
        toast('Service updated');
      } else {
        await createService({
          name: form.name,
          description: form.description || null,
          duration_minutes: form.duration_minutes,
          price_mad: form.price_mad,
          is_active: form.is_active,
        });
        toast('Service created');
      }
      setFormOpen(false);
      refresh();
    } catch (e) {
      toast('Failed: ' + (e instanceof Error ? e.message : 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (s: Service) => {
    try {
      await updateService(s.id, { is_active: !s.is_active });
      toast(s.is_active ? 'Service deactivated' : 'Service activated');
      refresh();
    } catch {
      toast('Failed to toggle service', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-playfair text-xl text-cream font-semibold">Services</h2>
        <button onClick={openAddForm} className="admin-btn-primary">+ Add Service</button>
      </div>

      {services.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <p className="text-cream/45 mb-4">No services yet</p>
          <button onClick={openAddForm} className="admin-btn-primary">Add Service</button>
        </div>
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
                className="admin-card p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-cream font-medium truncate">{s.name}</h3>
                      {!s.is_active && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400 border border-zinc-500/30 font-medium">Inactive</span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-cream/55 text-sm line-clamp-1">{s.description}</p>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-6 text-sm flex-shrink-0">
                    <span className="text-cream/55">{s.duration_minutes} min</span>
                    <span className="text-gold3 font-semibold">{s.price_mad} MAD</span>
                    <ToggleButton
                      enabled={s.is_active}
                      onChange={() => toggleActive(s)}
                    />
                    <button onClick={() => openEditForm(s)} className="admin-btn-outline text-xs">Edit</button>
                  </div>
                  <div className="flex sm:hidden items-center gap-2">
                    <span className="text-gold3 font-semibold text-sm">{s.price_mad} MAD</span>
                    <button onClick={() => openEditForm(s)} className="text-gold3 text-xs font-medium">Edit</button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingService ? 'Edit Service' : 'Add Service'}
      >
        <div className="space-y-4">
          <div>
            <label className="admin-section-label">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="admin-input w-full"
            />
            {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
          </div>

          <div>
            <label className="admin-section-label">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="admin-input w-full resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="admin-section-label">Duration (minutes) *</label>
              <input
                type="number"
                min={1}
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })}
                className="admin-input w-full"
              />
              {formErrors.duration_minutes && <p className="text-red-400 text-xs mt-1">{formErrors.duration_minutes}</p>}
            </div>
            <div>
              <label className="admin-section-label">Price (MAD) *</label>
              <input
                type="number"
                min={0}
                value={form.price_mad}
                onChange={(e) => setForm({ ...form, price_mad: parseFloat(e.target.value) || 0 })}
                className="admin-input w-full"
              />
              {formErrors.price_mad && <p className="text-red-400 text-xs mt-1">{formErrors.price_mad}</p>}
            </div>
          </div>

          <ToggleButton
            enabled={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
            label="Active"
          />

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setFormOpen(false)} className="admin-btn-outline">Cancel</button>
            <button onClick={handleSubmit} disabled={loading} className="admin-btn-primary disabled:opacity-50">
              {loading ? 'Saving...' : editingService ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}