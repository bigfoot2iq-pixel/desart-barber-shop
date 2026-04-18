"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  step?: number;
}

function fmtTime(v: string | null | undefined): string {
  if (!v) return "";
  const p = v.split(":");
  return `${p[0] || "00"}:${(p[1] || "00").slice(0, 2)}`;
}

function TimePicker({
  value,
  onChange,
  className,
  id,
  step = 300,
}: TimePickerProps) {
  return (
    <input
      type="time"
      id={id}
      value={fmtTime(value)}
      onChange={(e) => onChange(e.target.value)}
      step={step}
      className={cn(
        "h-7 rounded-md border border-input bg-transparent px-2 text-xs text-foreground tabular-nums transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
        className
      )}
    />
  );
}

export { TimePicker, fmtTime };
export type { TimePickerProps };