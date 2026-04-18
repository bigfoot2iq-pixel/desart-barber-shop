'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Salon } from '@/lib/types/database';
import { getAllSalons, createSalon, updateSalon } from '@/lib/queries';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocationPicker, type LocationValue } from '@/components/location-picker';
import { Modal, ToggleButton, useToast } from './ui';

interface SalonsManagerProps {
  initialSalons: Salon[];
}

const emptyForm = {
  name: '',
  address: '',
  latitude: 0,
  longitude: 0,
  image_url: '',
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
      image_url: s.image_url || '',
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
          image_url: form.image_url || null,
          is_active: form.is_active,
        });
        toast('Salon updated');
      } else {
        await createSalon({
          name: form.name,
          address: form.address,
          latitude: form.latitude,
          longitude: form.longitude,
          image_url: form.image_url || null,
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
        <h2 className="font-playfair text-xl text-foreground font-semibold">Salons</h2>
        <Button onClick={openAddForm}>+ Add Salon</Button>
      </div>

      {salons.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No salons yet</p>
            <Button onClick={openAddForm}>Add Salon</Button>
          </CardContent>
        </Card>
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
              >
                <Card className={`overflow-hidden${s.image_url || (s.latitude && s.longitude) ? ' pt-0' : ''}`}>
                  {s.image_url && (
                    <div className="w-full h-40 bg-muted">
                      <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  {!s.image_url && s.latitude && s.longitude && (
                    <div className="w-full h-32 bg-muted">
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
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-foreground font-medium">{s.name}</h3>
                      <ToggleButton
                        enabled={s.is_active}
                        onChange={() => toggleActive(s)}
                      />
                    </div>
                    <p className="text-muted-foreground text-sm mb-1">{s.address}</p>
                    <p className="text-muted-foreground/50 text-xs">
                      {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="xs" onClick={() => openEditForm(s)}>Edit</Button>
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
        title={editingSalon ? 'Edit Salon' : 'Add Salon'}
      >
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Name *</Label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1"
            />
            {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Address *</Label>
            <Input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1"
            />
            {formErrors.address && <p className="text-red-400 text-xs mt-1">{formErrors.address}</p>}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Image URL</Label>
            <Input
              type="url"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              className="mt-1"
              placeholder="https://..."
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Location</Label>
            <div className="mt-1">
              <LocationPicker
                defaultLocation={form.latitude || form.longitude ? { lat: form.latitude, lng: form.longitude } : undefined}
                onConfirm={(loc: LocationValue) => setForm({ ...form, latitude: loc.lat, longitude: loc.lng })}
              />
            </div>
          </div>

          <ToggleButton
            enabled={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
            label="Active"
          />

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : editingSalon ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}