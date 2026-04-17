'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Salon } from '@/lib/types/database';
import { getAllSalons, createSalon, updateSalon } from '@/lib/queries';
import { Modal, ToggleButton, useToast } from './ui';

interface SalonsManagerProps {
  initialSalons: Salon[];
}

const emptyForm = {
  name: '',
  address: '',
  latitude: 0,
  longitude: 0,
  is_active: true,
};

export default function SalonsManager({ initialSalons }: SalonsManagerProps) {
  const [salons, setSalons] = useState<Salon[]>(initialSalons);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSalon, setEditingSalon] = useState<Salon | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const data = await getAllSalons();
      setSalons(data);
    } catch {
      toast('Failed to refresh salons', 'error');
    }
  }, [toast]);

  const openAddForm = () => {
    setEditingSalon(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (s: Salon) => {
    setEditingSalon(s);
    setForm({
      name: s.name,
      address: s.address,
      latitude: s.latitude,
      longitude: s.longitude,
      is_active: s.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.address.trim()) errors.address = 'Address is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (editingSalon) {
        await updateSalon(editingSalon.id, {
          name: form.name,
          address: form.address,
          latitude: form.latitude,
          longitude: form.longitude,
          is_active: form.is_active,
        });
        toast('Salon updated');
      } else {
        await createSalon({
          name: form.name,
          address: form.address,
          latitude: form.latitude,
          longitude: form.longitude,
          is_active: form.is_active,
        });
        toast('Salon created');
      }
      setFormOpen(false);
      refresh();
    } catch (e) {
      toast('Failed: ' + (e instanceof Error ? e.message : 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (s: Salon) => {
    try {
      await updateSalon(s.id, { is_active: !s.is_active });
      toast(s.is_active ? 'Salon deactivated' : 'Salon activated');
      refresh();
    } catch {
      toast('Failed to toggle salon', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-playfair text-xl text-cream font-semibold">Salons</h2>
        <button onClick={openAddForm} className="admin-btn-primary">+ Add Salon</button>
      </div>

      {salons.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <p className="text-cream/45 mb-4">No salons yet</p>
          <button onClick={openAddForm} className="admin-btn-primary">Add Salon</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {salons.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="admin-card overflow-hidden"
              >
                {s.latitude && s.longitude && (
                  <div className="w-full h-32 bg-brand-black/40">
                    <iframe
                      width="100%"
                      height="128"
                      style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) brightness(0.8) contrast(1.2)' }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${s.longitude - 0.005},${s.latitude - 0.003},${s.longitude + 0.005},${s.latitude + 0.003}&layer=mapnik&marker=${s.latitude},${s.longitude}`}
                      title={`Map of ${s.name}`}
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-cream font-medium">{s.name}</h3>
                    <ToggleButton
                      enabled={s.is_active}
                      onChange={() => toggleActive(s)}
                    />
                  </div>
                  <p className="text-cream/55 text-sm mb-1">{s.address}</p>
                  <p className="text-cream/35 text-xs">
                    {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => openEditForm(s)} className="admin-btn-outline text-xs">Edit</button>
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
        title={editingSalon ? 'Edit Salon' : 'Add Salon'}
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
            <label className="admin-section-label">Address *</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="admin-input w-full"
            />
            {formErrors.address && <p className="text-red-400 text-xs mt-1">{formErrors.address}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="admin-section-label">Latitude</label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })}
                className="admin-input w-full"
              />
            </div>
            <div>
              <label className="admin-section-label">Longitude</label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })}
                className="admin-input w-full"
              />
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
              {loading ? 'Saving...' : editingSalon ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}