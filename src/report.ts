import { Booking, Room, Status, RoomUsage, PeakHour } from "./models.js";
import { Repository } from "./repository.js";

export function vnd(amount: number): string {
  return `${amount.toLocaleString("en-US")} VND`;
}

export function time(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

const PEAK_HOURS: PeakHour = {
  start: 18,
  end: 20,
  multiplier: 1.5,
}

export function calculatePeakHour(b: Booking): number {
  return Math.max(
    0,
    Math.min(PEAK_HOURS.end, b.start + b.hours) - Math.max(PEAK_HOURS.start, b.start)
  );
}


export function cost(b: Booking, rooms: Room[]): number {
  const price = rooms.find((r) => r.id === b.room)?.pricePerHour ?? 0;
  const peakHours = calculatePeakHour(b);
  const normalHours = b.hours - peakHours;
  return Math.round(price * (normalHours + peakHours * PEAK_HOURS.multiplier));

}
export function findConflict(b: Booking, all: Booking[]): Booking | undefined {
  return all.find(
    (existing) =>
      existing.id !== b.id &&
      existing.status !== Status.Cancelled &&
      overlaps(existing, b)
  );
}

// Two bookings clash when they use the same room on the same day at overlapping hours.
export function overlaps(a: Booking, b: Booking): boolean {
  return a.room === b.room && a.date === b.date && a.start < b.start + b.hours && b.start < a.start + a.hours;
}

// The first earlier, non-cancelled booking that clashes with b (if any).
function clashWith(b: Booking, all: Booking[]): Booking | undefined {
  if (b.status === Status.Cancelled) return undefined;
  const earlier = all.slice(0, all.indexOf(b));
  return earlier.find((o) => o.status !== Status.Cancelled && overlaps(o, b));
}

function mark(status: Status): string {
  switch (status) {
    case Status.Confirmed:
      return "✔";
    case Status.Pending:
      return "○";
    case Status.Cancelled:
      return "✖";
  }
}

export function printReport(bookings: Booking[], rooms: Room[]): void {
  const lines = bookings.map((b) => {
    const clash = clashWith(b, bookings);
    const slot = `${time(b.start)}-${time(b.start + b.hours)}`;
    const warn = clash ? `  ⚠ overlaps ${clash.customer}` : "";
    return `  ${mark(b.status)} ${slot}  ${b.room.padEnd(7)}${b.customer.padEnd(7)}${vnd(cost(b, rooms)).padStart(11)}${warn}`;
  });
  console.log(lines.join("\n"));

  // The assembly line: filter -> map -> reduce
  const confirmed = bookings.filter((b) => b.status === Status.Confirmed);
  const amounts = confirmed.map((b) => cost(b, rooms));
  const revenue = amounts.reduce((sum, a) => sum + a, 0);
  console.log(`Revenue (confirmed): ${vnd(revenue)}`);

  const conflicts = bookings.filter((b) => clashWith(b, bookings)).length;
  if (conflicts > 0) console.log(`⚠ ${conflicts} conflict(s) found`);
}
export function Revenue(bookings: Booking[], rooms: Room[], date: string): number {
  const confirmed = bookings.filter((booking) => booking.status === Status.Confirmed && booking.date === date);
  const amounts = confirmed.map((b) => cost(b, rooms));
  return amounts.reduce((sum, a) => sum + a, 0);
}
//THINKING
export async function getDailyRoomUsage(bookingRepo: Repository<Booking>,roomRepo: Repository<Room>, date: string): Promise<RoomUsage[]>{
    const b = bookingRepo.getAll();
    const r = roomRepo.getAll();
    const results: RoomUsage[] = [];
  r.forEach((room) => {
    const bookingsForRoom = b.filter((booking) => booking.room === room.id && booking.date === date && booking.status === Status.Confirmed);
    const totalHours = bookingsForRoom.reduce((sum, booking) => sum + booking.hours, 0);
    const usagePercentage = (totalHours / 24) * 100;
    results.push({ ...room, date, totalHours, usagePercentage });
  });
  return results;
};




