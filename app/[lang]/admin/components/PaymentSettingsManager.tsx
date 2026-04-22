'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from './ui';
import { updatePaymentSettings } from '@/lib/queries/payment-settings';
import { useT } from '@/lib/i18n/client-dictionary';
import type { PaymentSettings, PaymentBankAccount } from '@/lib/types/database';

interface PaymentSettingsManagerProps {
  initialSettings: PaymentSettings;
  initialAccounts: PaymentBankAccount[];
}

export default function PaymentSettingsManager({ initialSettings, initialAccounts }: PaymentSettingsManagerProps) {
  const tAdmin = useT('admin');
  const tCommon = useT('common');
  const { toast } = useToast();
  const [bankTransferEnabled, setBankTransferEnabled] = useState(initialSettings.bank_transfer_enabled);
  const [paymentPhone, setPaymentPhone] = useState(initialSettings.payment_phone ?? '');
  const [instructions, setInstructions] = useState(initialSettings.instructions ?? '');
  const [saving, setSaving] = useState(false);

  const hasAccounts = initialAccounts.length > 0;
  const canSave = !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await updatePaymentSettings({
        bank_transfer_enabled: bankTransferEnabled,
        payment_phone: paymentPhone.trim() || null,
        instructions: instructions.trim() || null,
      });
      toast(tAdmin('payment.toastSaved'), 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : tAdmin('payment.toastSaveFailed');
      toast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-playfair text-lg text-foreground">{tAdmin('payment.title')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{tAdmin('payment.subtitle')}</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="min-w-[120px]"
          >
            {saving ? tAdmin('payment.saving') : tAdmin('payment.save')}
          </Button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-accent/30">
          <div>
            <p className="text-sm font-medium text-foreground">{tAdmin('payment.acceptBankTransfers')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{tAdmin('payment.acceptBankTransfersDesc')}</p>
          </div>
          <label className={`relative inline-flex items-center ${hasAccounts ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
            <input
              type="checkbox"
              checked={bankTransferEnabled}
              onChange={(e) => {
                if (!hasAccounts) return;
                setBankTransferEnabled(e.target.checked);
              }}
              disabled={!hasAccounts}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {!hasAccounts && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600">
            {tAdmin('payment.bankTransferDisabledWarning')}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ps-phone" className="text-xs">{tAdmin('payment.fieldPaymentPhone')}</Label>
            <Input
              id="ps-phone"
              value={paymentPhone}
              onChange={(e) => setPaymentPhone(e.target.value)}
              placeholder={tAdmin('payment.fieldPaymentPhonePlaceholder')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ps-instructions" className="text-xs">{tAdmin('payment.fieldInstructionsOptional')}</Label>
            <textarea
              id="ps-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={tAdmin('payment.fieldInstructionsPlaceholder')}
              rows={3}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}