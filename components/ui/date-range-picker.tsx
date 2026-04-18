"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface DateRange {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  placeholder?: string;
  minDate?: string | null;
  maxDate?: string | null;
  disabledDates?: Set<string>;
  className?: string;
}

function formatDisplay(from: string, to: string, placeholder: string) {
  if (!from && !to) return placeholder;
  if (from && to) {
    const f = new Date(from + "T00:00:00");
    const t = new Date(to + "T00:00:00");
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    if (from === to) return f.toLocaleDateString("en-US", opts);
    return `${f.toLocaleDateString("en-US", opts)} – ${t.toLocaleDateString("en-US", opts)}`;
  }
  if (from) {
    const f = new Date(from + "T00:00:00");
    return `${f.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – …`;
  }
  return `… – ${new Date(to + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range…",
  minDate = null,
  maxDate = null,
  disabledDates = new Set(),
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [hoverDate, setHoverDate] = React.useState<string | null>(null);
  const [selectPhase, setSelectPhase] = React.useState<"from" | "to">("from");

  const [navYear, setNavYear] = React.useState(() => new Date().getFullYear());
  const [navMonth, setNavMonth] = React.useState(() => new Date().getMonth());

  const rightMonth = navMonth === 11 ? 0 : navMonth + 1;
  const rightYear = navMonth === 11 ? navYear + 1 : navYear;

  const canGoPrev = React.useMemo(() => {
    if (!minDate) return true;
    const d = new Date(minDate + "T00:00:00");
    return (
      navYear > d.getFullYear() ||
      (navYear === d.getFullYear() && navMonth > d.getMonth())
    );
  }, [navYear, navMonth, minDate]);

  const canGoNext = React.useMemo(() => {
    if (!maxDate) return true;
    const d = new Date(maxDate + "T00:00:00");
    return (
      rightYear < d.getFullYear() ||
      (rightYear === d.getFullYear() && rightMonth < d.getMonth())
    );
  }, [rightYear, rightMonth, maxDate]);

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
    if (selectPhase === "from") {
      onChange({ from: dateStr, to: "" });
      setSelectPhase("to");
      setHoverDate(null);
    } else {
      const fromVal = value.from;
      if (!fromVal) {
        onChange({ from: dateStr, to: "" });
        setSelectPhase("to");
        return;
      }
      if (dateStr < fromVal) {
        onChange({ from: dateStr, to: fromVal });
      } else {
        onChange({ from: fromVal, to: dateStr });
      }
      setSelectPhase("from");
      setOpen(false);
    }
  };

  const effectiveTo = selectPhase === "to" && hoverDate && value.from
    ? (hoverDate > value.from ? hoverDate : "")
    : value.to;

  const handleClear = () => {
    onChange({ from: "", to: "" });
    setSelectPhase("from");
    setHoverDate(null);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <button
            type="button"
            className={cn(
              "h-8 flex items-center gap-2 rounded-lg border border-input bg-transparent px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
              className,
            )}
          >
            <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
            <span className="truncate">
              {formatDisplay(value.from, value.to, placeholder)}
            </span>
          </button>
        }
      />

      <Popover.Portal>
        <Popover.Positioner side="bottom" sideOffset={4}>
          <Popover.Popup
            className="rounded-xl border border-border bg-popover shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div className="p-4 min-w-[560px] max-w-[calc(100vw-2rem)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    From
                  </span>
                  <span className="text-muted-foreground/50">—</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    To
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(value.from || value.to) && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground/60">
                    {selectPhase === "from" ? "Select start date" : "Select end date"}
                  </span>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-1 min-w-0">
                  <Calendar
                    year={navYear}
                    month={navMonth}
                    selectedFrom={value.from}
                    selectedTo={effectiveTo}
                    minDate={minDate}
                    maxDate={maxDate}
                    disabledDates={disabledDates}
                    canGoPrev={canGoPrev}
                    canGoNext={false}
                    onPrevMonth={handlePrevMonth}
                    onNextMonth={() => {}}
                    onSelect={handleDaySelect}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Calendar
                    year={rightYear}
                    month={rightMonth}
                    selectedFrom={value.from}
                    selectedTo={effectiveTo}
                    minDate={minDate}
                    maxDate={maxDate}
                    disabledDates={disabledDates}
                    canGoPrev={false}
                    canGoNext={canGoNext}
                    onPrevMonth={() => {}}
                    onNextMonth={handleNextMonth}
                    onSelect={handleDaySelect}
                  />
                </div>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export type { DateRange, DateRangePickerProps };