"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_HEADER = ["M", "T", "W", "T", "F", "S", "S"];

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface CalendarDay {
  date: number;
  isCurrentMonth: boolean;
  dateStr: string;
  isToday: boolean;
  isSelected: boolean;
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isDisabled: boolean;
}

function buildCalendarDays(
  year: number,
  month: number,
  selectedFrom: string,
  selectedTo: string,
  minDate: string | null,
  maxDate: string | null,
  disabledDates: Set<string>
): CalendarDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDayMon = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const days: CalendarDay[] = [];

  for (let i = firstDayMon - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const dateStr = toDateStr(py, pm, d);
    days.push({
      date: d,
      isCurrentMonth: false,
      dateStr,
      isToday: false,
      isSelected: false,
      isInRange: false,
      isRangeStart: false,
      isRangeEnd: false,
      isDisabled: true,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(year, month, d);
    const dayDate = new Date(year, month, d);
    dayDate.setHours(0, 0, 0, 0);

    let isDisabled = disabledDates.has(dateStr);
    if (dateStr < todayStr) isDisabled = true;
    if (minDate && dateStr < minDate) isDisabled = true;
    if (maxDate && dateStr > maxDate) isDisabled = true;

    const isSelected = dateStr === selectedFrom || dateStr === selectedTo;
    const isRangeStart = dateStr === selectedFrom;
    const isRangeEnd = dateStr === selectedTo;
    const isInRange =
      !!selectedFrom &&
      !!selectedTo &&
      dateStr > selectedFrom &&
      dateStr < selectedTo;

    days.push({
      date: d,
      isCurrentMonth: true,
      dateStr,
      isToday: dateStr === todayStr,
      isSelected,
      isInRange,
      isRangeStart,
      isRangeEnd,
      isDisabled,
    });
  }

  const totalCells = days.length;
  const rows = Math.ceil(totalCells / 7);
  const targetCells = rows * 7;
  for (let i = 1; i <= targetCells - totalCells; i++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    const dateStr = toDateStr(ny, nm, i);
    days.push({
      date: i,
      isCurrentMonth: false,
      dateStr,
      isToday: false,
      isSelected: false,
      isInRange: false,
      isRangeStart: false,
      isRangeEnd: false,
      isDisabled: true,
    });
  }

  return days;
}

interface CalendarProps {
  year: number;
  month: number;
  selectedFrom: string;
  selectedTo: string;
  minDate?: string | null;
  maxDate?: string | null;
  disabledDates?: Set<string>;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelect: (dateStr: string) => void;
}

function Calendar({
  year,
  month,
  selectedFrom,
  selectedTo,
  minDate = null,
  maxDate = null,
  disabledDates = new Set(),
  canGoPrev,
  canGoNext,
  onPrevMonth,
  onNextMonth,
  onSelect,
}: CalendarProps) {
  const days = buildCalendarDays(
    year,
    month,
    selectedFrom,
    selectedTo,
    minDate,
    maxDate,
    disabledDates
  );

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={onPrevMonth}
          disabled={!canGoPrev}
          className={cn(
            "size-7 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
          )}
        >
          <ChevronLeftIcon className="size-4 text-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {MONTHS_SHORT[month]} {year}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          disabled={!canGoNext}
          className={cn(
            "size-7 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
          )}
        >
          <ChevronRightIcon className="size-4 text-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_HEADER.map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day.isCurrentMonth) {
            return (
              <div
                key={i}
                className="rounded-md py-1.5 text-center text-[13px] text-muted-foreground/30"
              >
                {day.date}
              </div>
            );
          }

          if (day.isDisabled) {
            return (
              <div
                key={i}
                className="rounded-md py-1.5 text-center text-[13px] text-muted-foreground/40 line-through cursor-not-allowed"
              >
                {day.date}
              </div>
            );
          }

          const isRangeEnd = day.isRangeStart || day.isRangeEnd;
          const isInRange = day.isInRange;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(day.dateStr)}
              className={cn(
                "rounded-md py-1.5 text-center text-[13px] font-semibold transition-all duration-150",
                isRangeEnd
                  ? "bg-primary text-primary-foreground shadow-sm border border-primary z-10 relative"
                  : isInRange
                  ? "bg-primary/10 text-foreground"
                  : day.isToday
                  ? "border border-primary/40 text-foreground hover:bg-primary/10"
                  : "border border-transparent text-foreground hover:bg-muted hover:border-border",
              )}
            >
              {day.date}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { Calendar };
export type { CalendarProps };
