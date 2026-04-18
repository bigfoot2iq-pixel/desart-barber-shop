"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  minDate?: string | null;
  maxDate?: string | null;
  disabledDates?: Set<string>;
  className?: string;
}

function formatSingleDate(dateStr: string, placeholder: string) {
  if (!dateStr) return placeholder;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date…",
  minDate = null,
  maxDate = null,
  disabledDates = new Set(),
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const today = new Date();
  const [navYear, setNavYear] = React.useState(value ? new Date(value + "T00:00:00").getFullYear() : today.getFullYear());
  const [navMonth, setNavMonth] = React.useState(value ? new Date(value + "T00:00:00").getMonth() : today.getMonth());

  const canGoPrev = React.useMemo(() => {
    if (!minDate) return true;
    const d = new Date(minDate + "T00:00:00");
    return navYear > d.getFullYear() || (navYear === d.getFullYear() && navMonth > d.getMonth());
  }, [navYear, navMonth, minDate]);

  const canGoNext = React.useMemo(() => {
    if (!maxDate) return true;
    const d = new Date(maxDate + "T00:00:00");
    return navYear < d.getFullYear() || (navYear === d.getFullYear() && navMonth < d.getMonth());
  }, [navYear, navMonth, maxDate]);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    setNavMonth((prev) => {
      if (prev === 0) {
        setNavYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    setNavMonth((prev) => {
      if (prev === 11) {
        setNavYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleDaySelect = (dateStr: string) => {
    onChange(dateStr);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <button
            type="button"
            className={cn(
              "h-7 flex items-center gap-1.5 rounded-md border border-input bg-transparent px-2 text-xs text-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
              !value && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{formatSingleDate(value, placeholder)}</span>
          </button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="start" className="z-[60]">
          <Popover.Popup className="rounded-xl border border-border bg-popover shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 duration-100">
            <div className="p-4 min-w-[300px]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Select date
                </span>
                {value && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <Calendar
                year={navYear}
                month={navMonth}
                selectedFrom={value}
                selectedTo={value}
                minDate={minDate}
                maxDate={maxDate}
                disabledDates={disabledDates}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onSelect={handleDaySelect}
              />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export { DatePicker };
export type { DatePickerProps };