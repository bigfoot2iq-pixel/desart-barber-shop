export const SLOT_STEP_MINUTES = 30;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function toHHMMSS(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export type WorkingHours = { start: number; end: number } | null;

export function getWorkingHoursForDate(
  dateStr: string,
  weekly: { day_of_week: number; is_available: boolean; start_time: string; end_time: string }[],
  overrides: { override_date: string; is_available: boolean; start_time: string | null; end_time: string | null }[]
): WorkingHours {
  const override = overrides.find((o) => o.override_date === dateStr);
  if (override) {
    if (!override.is_available || !override.start_time || !override.end_time) return null;
    return { start: toMinutes(override.start_time), end: toMinutes(override.end_time) };
  }
  const d = new Date(`${dateStr}T12:00:00`);
  const dow = d.getDay();
  const weekday = weekly.find((w) => w.day_of_week === dow);
  if (!weekday || !weekday.is_available) return null;
  return { start: toMinutes(weekday.start_time), end: toMinutes(weekday.end_time) };
}

export function buildTimeSlots(
  hours: WorkingHours,
  durationMin: number,
  booked: { start_time: string; end_time: string }[],
  nowMinutes?: number
): string[] {
  if (!hours || durationMin <= 0) return [];
  const slots: string[] = [];
  const bookedRanges = booked.map((b) => ({ start: toMinutes(b.start_time), end: toMinutes(b.end_time) }));
  for (let t = hours.start; t + durationMin <= hours.end; t += SLOT_STEP_MINUTES) {
    if (nowMinutes !== undefined && t < nowMinutes) continue;
    const slotEnd = t + durationMin;
    const conflicts = bookedRanges.some((b) => t < b.end && slotEnd > b.start);
    if (!conflicts) slots.push(toHHMM(t));
  }
  return slots;
}

export type TimeSlotStatus = { time: string; available: boolean };

export function buildTimeSlotsWithStatus(
  hours: WorkingHours,
  durationMin: number,
  booked: { start_time: string; end_time: string }[],
  nowMinutes?: number
): TimeSlotStatus[] {
  if (!hours || durationMin <= 0) return [];
  const slots: TimeSlotStatus[] = [];
  const bookedRanges = booked.map((b) => ({ start: toMinutes(b.start_time), end: toMinutes(b.end_time) }));
  for (let t = hours.start; t + durationMin <= hours.end; t += SLOT_STEP_MINUTES) {
    if (nowMinutes !== undefined && t < nowMinutes) {
      slots.push({ time: toHHMM(t), available: false });
      continue;
    }
    const slotEnd = t + durationMin;
    const conflicts = bookedRanges.some((b) => t < b.end && slotEnd > b.start);
    slots.push({ time: toHHMM(t), available: !conflicts });
  }
  return slots;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
