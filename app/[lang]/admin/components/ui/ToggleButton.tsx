'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ToggleButtonProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function ToggleButton({ enabled, onChange, label, disabled = false }: ToggleButtonProps) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={disabled}
      />
      {label && (
        <Label className="text-sm text-muted-foreground">{label}</Label>
      )}
    </div>
  );
}