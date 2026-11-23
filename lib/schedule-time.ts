// Schedules are interpreted in IST (+05:30). Shared by the public schedule
// listing and booking creation so both agree on when a slot starts.
export const IST_OFFSET_MIN = 330;

// Slots starting sooner than this are hidden from the public page and
// rejected by the booking API.
export const BOOKING_LEAD_MINUTES = 30;

export function startOfDayIST(date: Date): Date {
  // Convert given UTC timestamp to IST by adding offset, take its UTC Y/M/D, then subtract offset to get UTC timestamp of that IST midnight.
  const ist = new Date(date.getTime() + IST_OFFSET_MIN * 60000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - IST_OFFSET_MIN * 60000);
}

// Absolute start instant of an "HH:MM" slot on a schedule's day (IST).
// Returns an Invalid Date if startTime is malformed.
export function slotStartInstant(scheduleDate: Date, startTime: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  return new Date(startOfDayIST(scheduleDate).getTime() + (h * 60 + m) * 60000);
}
