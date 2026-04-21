export const BOOKING_WINDOW_DAYS = 30;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DateSlot = {
  id: string;
  shortDay: string;
  displayDate: string;
  fullDate: string;
};

export function buildDateSlots(): DateSlot[] {
  const slots: DateSlot[] = [];
  const today = new Date();

  for (let i = 1; i <= BOOKING_WINDOW_DAYS; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const month = MONTHS[date.getMonth()];
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    slots.push({
      id: `${y}-${m}-${d}`,
      shortDay: DAYS[date.getDay()],
      displayDate: `${date.getDate()} ${month}`,
      fullDate: `${date.getDate()} ${month} ${date.getFullYear()}`,
    });
  }

  return slots;
}

export type { DateSlot };
