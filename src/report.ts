import { Booking, Coupon, Room, RoomName, Status } from "./models.js";

export function vnd(amount: number): string {
  return `${amount.toLocaleString("en-US")} VND`;
}

export function time(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function roomPrice(room: RoomName, rooms: Room[]): number {
  return rooms.find((r) => r.id === room)?.pricePerHour ?? 0;
}

export function findCoupon(
  code: string | undefined,
  coupons: Coupon[],
): Coupon | undefined {
  if (!code) return undefined;

  const target = code.toUpperCase();
  return coupons.find((c) => c.id.toUpperCase() === target);
}

/** Validate whether a coupon can be applied to a booking with the given room and duration. */
export function validateCoupon(
  coupon: Coupon,
  room: RoomName,
  hours: number,
  rooms: Room[],
): string | undefined {
  if (coupon.couponType === "FIXED") {
    const basePrice = hours * roomPrice(room, rooms);

    if (basePrice < coupon.minimum) {
      return `Coupon ${coupon.id} requires minimum booking cost of ${vnd(coupon.minimum)} (order is ${vnd(basePrice)})`;
    }
  }
  return undefined;
}

export function couponDiscount(
  b: Booking,
  rooms: Room[],
  coupons: Coupon[] = [],
): number {
  const coupon = findCoupon(b.coupon, coupons);
  if (!coupon) return 0;

  const pricePerHour = roomPrice(b.room, rooms);
  const basePrice = b.hours * pricePerHour;

  switch (coupon.couponType) {
    case "HOUR":
      return Math.max(0, Math.min(coupon.freeHours, b.hours)) * pricePerHour;

    case "FIXED":
      if (basePrice < coupon.minimum) {
        return 0;
      }
      return Math.min(basePrice, Math.max(0, coupon.discount));
  }
}

export function cost(
  b: Booking,
  rooms: Room[],
  coupons: Coupon[] = [],
): number {
  const basePrice = b.hours * roomPrice(b.room, rooms);
  return Math.max(0, basePrice - couponDiscount(b, rooms, coupons));
}

// Two bookings clash when they use the same room on the same day at overlapping hours.
export function overlaps(a: Booking, b: Booking): boolean {
  return (
    a.room === b.room &&
    a.date === b.date &&
    a.start < b.start + b.hours &&
    b.start < a.start + a.hours
  );
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

export function printReport(
  bookings: Booking[],
  rooms: Room[],
  coupons: Coupon[] = [],
): void {
  const lines = bookings.map((b) => {
    const clash = clashWith(b, bookings);
    const slot = `${time(b.start)}-${time(b.start + b.hours)}`;
    const warn = clash ? `  ⚠ overlaps ${clash.customer}` : "";
    const price = cost(b, rooms, coupons);

    // Apply coupon if available
    const applied = findCoupon(b.coupon, coupons);
    const discount = couponDiscount(b, rooms, coupons);
    const coupon = b.coupon
      ? applied
        ? `  ${applied.id.padEnd(8)}${`-${vnd(discount)}`.padStart(12)}`
        : `  ${b.coupon} (unknown)`
      : "";
    return `  ${mark(b.status)} ${slot}  ${b.room.padEnd(7)}${b.customer.padEnd(7)}${vnd(price).padStart(11)}${warn}${coupon}`;
  });
  console.log(lines.join("\n"));

  // The assembly line: filter -> map -> reduce
  const confirmed = bookings.filter((b) => b.status === Status.Confirmed);
  const amounts = confirmed.map((b) => cost(b, rooms, coupons));
  const revenue = amounts.reduce((sum, a) => sum + a, 0);
  console.log(`Revenue (confirmed): ${vnd(revenue)}`);

  const conflicts = bookings.filter((b) => clashWith(b, bookings)).length;
  if (conflicts > 0) console.log(`⚠ ${conflicts} conflict(s) found`);
}

/** Print all configured coupon codes and their rules. */
export function printCoupons(coupons: Coupon[]): void {
  if (coupons.length === 0) {
    console.log("No coupons available.");
    return;
  }

  const lines = coupons.map((c) => {
    switch (c.couponType) {
      case "HOUR":
        return `  ${c.id.padEnd(10)} HOUR   ${c.freeHours} free hour(s)`;

      case "FIXED":
        return `  ${c.id.padEnd(10)} FIXED  ${vnd(c.discount)} off (min order ${vnd(c.minimum)})`;
    }
  });
  console.log("Available coupons:");
  console.log(lines.join("\n"));
}

const HOURS_PER_DAY = 24;

export interface RoomDailyStats {
  room: RoomName;
  confirmed: number;
  pending: number;
  cancelled: number;
  usedHours: number;
  utilizationPct: number;
  revenue: number;
  discount: number;
}

function occupiedHours(bookings: Booking[]): number {
  return Array.from({ length: HOURS_PER_DAY }, (_, hour) =>
    bookings.some((b) => hour >= b.start && hour < b.start + b.hours),
  ).filter(Boolean).length;
}

function buildRoomStats(
  room: Room,
  dateBookings: Booking[],
  rooms: Room[],
  coupons: Coupon[],
): RoomDailyStats {
  const roomBookings = dateBookings.filter((b) => b.room === room.id);
  const confirmed = roomBookings.filter((b) => b.status === Status.Confirmed);
  const pending = roomBookings.filter((b) => b.status === Status.Pending);
  const cancelled = roomBookings.filter((b) => b.status === Status.Cancelled);
  const active = roomBookings.filter((b) => b.status !== Status.Cancelled);

  const usedHours = occupiedHours(active);
  const revenue = confirmed.reduce(
    (sum, b) => sum + cost(b, rooms, coupons),
    0,
  );
  const discount = confirmed.reduce(
    (sum, b) => sum + couponDiscount(b, rooms, coupons),
    0,
  );

  return {
    room: room.id,
    confirmed: confirmed.length,
    pending: pending.length,
    cancelled: cancelled.length,
    usedHours,
    utilizationPct: (usedHours / HOURS_PER_DAY) * 100,
    revenue,
    discount,
  };
}

/** Print per-room usage, utilization rate, revenue, and discounts for a date. */
export function printDailyStats(
  bookings: Booking[],
  rooms: Room[],
  date: string,
  coupons: Coupon[] = [],
): void {
  if (rooms.length === 0) {
    console.log("No rooms configured.");
    return;
  }

  const dateBookings = bookings.filter((b) => b.date === date);
  const stats = rooms.map((room) =>
    buildRoomStats(room, dateBookings, rooms, coupons),
  );

  const lines = stats.map((s) => {
    const pct = `${s.utilizationPct.toFixed(1)}%`.padStart(5);
    const hoursCol = `${String(s.usedHours).padStart(2)}h/${HOURS_PER_DAY}h (${pct})`;
    const counts = `✔ ${s.confirmed}  ○ ${s.pending}  ✖ ${s.cancelled}`;
    return `  ${s.room.padEnd(7)} ${counts}   ${hoursCol}  Revenue: ${vnd(s.revenue).padStart(13)}  Discount: ${vnd(s.discount).padStart(11)}`;
  });

  const totals = stats.reduce(
    (acc, s) => ({
      confirmed: acc.confirmed + s.confirmed,
      pending: acc.pending + s.pending,
      cancelled: acc.cancelled + s.cancelled,
      usedHours: acc.usedHours + s.usedHours,
      revenue: acc.revenue + s.revenue,
      discount: acc.discount + s.discount,
    }),
    { confirmed: 0, pending: 0, cancelled: 0, usedHours: 0, revenue: 0, discount: 0 },
  );

  const totalCapacity = rooms.length * HOURS_PER_DAY;
  const totalPct = ((totals.usedHours / totalCapacity) * 100).toFixed(1);
  const totalCount = totals.confirmed + totals.pending + totals.cancelled;

  console.log(`Room usage stats for ${date}:`);
  console.log(lines.join("\n"));
  console.log(
    `Summary: ${totalCount} booking(s) (✔ ${totals.confirmed}, ○ ${totals.pending}, ✖ ${totals.cancelled}), ${totals.usedHours}h/${totalCapacity}h used (${totalPct}%), Revenue: ${vnd(totals.revenue)}, Discounts: ${vnd(totals.discount)}`,
  );

  const maxHours = Math.max(...stats.map((s) => s.usedHours));
  const maxRevenue = Math.max(...stats.map((s) => s.revenue));
  const highlights = [
    maxHours > 0
      ? `Most used: ${stats.filter((s) => s.usedHours === maxHours).map((s) => s.room).join(", ")} (${maxHours}h)`
      : undefined,
    maxRevenue > 0
      ? `Top revenue: ${stats.filter((s) => s.revenue === maxRevenue).map((s) => s.room).join(", ")} (${vnd(maxRevenue)})`
      : undefined,
  ].filter((item): item is string => item !== undefined);

  if (highlights.length > 0) {
    console.log(highlights.join(" | "));
  }
}
