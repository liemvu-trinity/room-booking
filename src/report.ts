import { Booking, Room, RoomName, Status } from "./models.js";

export function vnd(amount: number): string {
  return `${amount.toLocaleString("en-US")} VND`;
}

export function time(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function cost(b: Booking, rooms: Room[]): number {
  const price = rooms.find((r) => r.id === b.room)?.pricePerHour ?? 0;
  return b.hours * price;
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

export function listDate(bookings: Booking[], date: string): Array<Booking> {
  return bookings.filter((booking) => booking.date === date);
}

export function roomUsage(bookings: Booking[], date: string, room: RoomName, rooms: Room[]): void {
  const dailyBookings = listDate(bookings, date);
  const confirmedBookings = dailyBookings.filter((booking) => booking.status === Status.Confirmed);
  const roomBookings = confirmedBookings
    .filter((booking) => booking.room === room)
    .sort((a, b) => a.start - b.start)
    .map((booking) => ({
      ...booking,
      amount: cost(booking, rooms),
    }));

  const hours = roomBookings.reduce((sum, booking) => sum + booking.hours, 0);
  console.log(`${room}: ${roomBookings.length} confirmed booking(s), ${hours} booked hour(s)`);
  if (roomBookings.length === 0) {
    console.log("No bookings.");
    return;
  }
  console.table(roomBookings.map((booking) => ({
    id: booking.id,
    customer: booking.customer,
    start: time(booking.start),
    end: time(booking.start + booking.hours),
    hours: booking.hours,
    status: booking.status,
    amount: vnd(booking.amount),
  })));
}

export function venueReport(bookings: Booking[], date: string, rooms: Room[]): number {
  const list = listDate(bookings, date);
  const venueList = list.filter((booking) => booking.status === Status.Confirmed);
  return venueList.reduce((sum, b) => sum + cost(b, rooms), 0);
}
