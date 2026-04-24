'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PaymentBankAccount } from '@/lib/types/database';
import {
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  reorderBankAccounts,
} from '@/lib/queries/payment-settings';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ToggleButton, useToast } from './ui';

interface PaymentBankAccountsManagerProps {
  initialAccounts: PaymentBankAccount[];
}

function formatRib(rib: string): string {
  return rib.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
}

const emptyForm = {
  label: '',
  account_holder: '',
  bank_name: '',
  rib: '',
  iban: '',
  swift_bic: '',
  is_active: true,
};

export default function PaymentBankAccountsManager({ initialAccounts }: PaymentBankAccountsManagerProps) {
  const [accounts, setAccounts] = useState<PaymentBankAccount[]>(initialAccounts);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PaymentBankAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentBankAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const data = await listBankAccounts({ includeInactive: true });
      setAccounts(data);
    } catch {
      toast('Failed to refresh bank accounts', 'error');
    }
  }, [toast]);

  const openAddForm = () => {
    setEditingAccount(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (a: PaymentBankAccount) => {
    setEditingAccount(a);
    setForm({
      label: a.label ?? '',
      account_holder: a.account_holder,
      bank_name: a.bank_name,
      rib: a.rib,
      iban: a.iban ?? '',
      swift_bic: a.swift_bic ?? '',
      is_active: a.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.account_holder.trim()) errors.account_holder = 'Account holder is required';
    if (!form.bank_name.trim()) errors.bank_name = 'Bank name is required';
    if (!form.rib.trim()) errors.rib = 'RIB is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (editingAccount) {
        await updateBankAccount(editingAccount.id, {
          label: form.label.trim() || null,
          account_holder: form.account_holder.trim(),
          bank_name: form.bank_name.trim(),
          rib: form.rib.trim(),
          iban: form.iban.trim() || null,
          swift_bic: form.swift_bic.trim() || null,
          is_active: form.is_active,
        });
        toast('Bank account updated');
      } else {
        await createBankAccount({
          label: form.label.trim() || null,
          account_holder: form.account_holder.trim(),
          bank_name: form.bank_name.trim(),
          rib: form.rib.trim(),
          iban: form.iban.trim() || null,
          swift_bic: form.swift_bic.trim() || null,
          is_active: form.is_active,
        });
        toast('Bank account created');
      }
      setFormOpen(false);
      refresh();
    } catch (e) {
      toast('Failed: ' + (e instanceof Error ? e.message : 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (a: PaymentBankAccount) => {
    if (togglingId === a.id) return;
    setTogglingId(a.id);
    try {
      await updateBankAccount(a.id, { is_active: !a.is_active });
      toast(a.is_active ? 'Bank account deactivated' : 'Bank account activated');
      await refresh();
    } catch {
      toast('Failed to toggle bank account', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteBankAccount(deleteTarget.id);
      toast('Bank account deleted');
      setDeleteTarget(null);
      await refresh();
    } catch {
      toast('Failed to delete bank account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const moveUp = async (index: number) => {
    if (index <= 0 || movingId !== null) return;
    const accountId = accounts[index].id;
    setMovingId(accountId);
    const next = [...accounts];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    setAccounts(next);
    try {
      await reorderBankAccounts(next.map((a) => a.id));
    } catch {
      toast('Failed to reorder bank accounts', 'error');
      refresh();
    } finally {
      setMovingId(null);
    }
  };

  const moveDown = async (index: number) => {
    if (index >= accounts.length - 1 || movingId !== null) return;
    const accountId = accounts[index].id;
    setMovingId(accountId);
    const next = [...accounts];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    setAccounts(next);
    try {
      await reorderBankAccounts(next.map((a) => a.id));
    } catch {
      toast('Failed to reorder bank accounts', 'error');
      refresh();
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-playfair text-xl text-foreground font-semibold">Bank Accounts</h2>
        <Button onClick={openAddForm}>+ Add Bank Account</Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-muted-foreground">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            <p className="text-muted-foreground mb-4">No bank accounts yet. Add one to start accepting bank transfers.</p>
            <Button onClick={openAddForm}>Add Bank Account</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {accounts.map((a, idx) => (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <section aria-labelledby={`acct-${a.id}-heading`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 id={`acct-${a.id}-heading`} className="text-foreground font-medium truncate">{a.bank_name}</h3>
                            {!a.is_active && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400 border border-zinc-500/30 font-medium">Inactive</span>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">{a.account_holder}</p>
                          <p className="text-muted-foreground text-sm font-mono">{formatRib(a.rib)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            aria-label={`Move ${a.bank_name} up`}
                            disabled={idx === 0 || movingId !== null}
                            onClick={() => moveUp(idx)}
                            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="18 15 12 9 6 15" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${a.bank_name} down`}
                            disabled={idx === accounts.length - 1 || movingId !== null}
                            onClick={() => moveDown(idx)}
                            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          <ToggleButton
                            enabled={a.is_active}
                            onChange={() => toggleActive(a)}
                            disabled={togglingId === a.id}
                          />
                          <Button variant="outline" size="xs" onClick={() => openEditForm(a)}>Edit</Button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(a)}
                            className="p-2 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                            aria-label={`Delete ${a.bank_name}`}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </section>
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
        title={editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
      >
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Label <span className="text-muted-foreground font-normal normal-case">(optional)</span></Label>
            <Input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Personal, Business…"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Account Holder *</Label>
              <Input
                type="text"
                value={form.account_holder}
                onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
                className="mt-1"
              />
              {formErrors.account_holder && <p className="text-red-400 text-xs mt-1">{formErrors.account_holder}</p>}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Bank Name *</Label>
              <Input
                type="text"
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                className="mt-1"
              />
              {formErrors.bank_name && <p className="text-red-400 text-xs mt-1">{formErrors.bank_name}</p>}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">RIB *</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={form.rib}
              onChange={(e) => setForm({ ...form, rib: e.target.value })}
              placeholder="24-digit RIB"
              className="mt-1"
            />
            {formErrors.rib && <p className="text-red-400 text-xs mt-1">{formErrors.rib}</p>}
            <p className="text-[10px] text-muted-foreground mt-1">Store exactly as your bank displays it.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">IBAN <span className="text-muted-foreground font-normal normal-case">(optional)</span></Label>
              <Input
                type="text"
                value={form.iban}
                onChange={(e) => setForm({ ...form, iban: e.target.value })}
                placeholder="MA64…"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">SWIFT/BIC <span className="text-muted-foreground font-normal normal-case">(optional)</span></Label>
              <Input
                type="text"
                value={form.swift_bic}
                onChange={(e) => setForm({ ...form, swift_bic: e.target.value })}
                placeholder="BCMAMAMC"
                className="mt-1"
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
              {loading ? 'Saving...' : editingAccount ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Bank Account"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Delete <span className="text-foreground font-medium">{deleteTarget?.bank_name}</span>? This can&apos;t be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
