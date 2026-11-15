import { Booking, Coupon, Room, RoomName, Status } from "./models.js";
import { Repository } from "./repository.js";
import {
  cost,
  couponDiscount,
  findCoupon,
  printCoupons,
  printDailyStats,
  printReport,
  time,
  validateCoupon,
  vnd,
} from "./report.js";
import { loadBookings, loadCoupons, loadRooms, saveBookings } from "./storage.js";
import * as Readline from "node:readline/promises";

const DAY = "2026-11-12";
const ROOM_NAMES: RoomName[] = ["Sky", "Ocean", "Forest"];

// A type guard: checks at run time that a string really is a RoomName.
function isRoomName(value: string | undefined): value is RoomName {
  return ROOM_NAMES.includes(value as RoomName);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(year);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const isValidBookingHour = (start: number, hours: number): boolean => {
  // Validate start and hours
  if (isValidHour(start)
    && isValidHour(hours) && hours > 0
    && isValidHour(start + hours))
    return true;

  return false;
}

function isValidHour(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 23;
}

async function updateBookingStatus(
  bookingRepo: Repository<Booking>,
  id: string,
  nextStatus: Status.Confirmed | Status.Cancelled,
): Promise<Booking | undefined> {
  const target = bookingRepo.findById(id);

  // Check if the booking exists
  if (!target) {
    console.log("Booking not found");
    return undefined;
  }

  // Check if the status is already set
  if (target.status === nextStatus) {
    console.log(`Booking is already ${nextStatus.toLowerCase()}`);
    return undefined;
  }

  // Check if the booking is cancelled and trying to confirm it
  if (nextStatus === Status.Confirmed && target.status === Status.Cancelled) {
    console.log("Cannot confirm a cancelled booking");
    return undefined;
  }

  // Update the booking status and save
  const updated: Booking = { ...target, status: nextStatus };
  if (!bookingRepo.update(updated)) {
    console.log(`Failed to update booking ${id}`);
    return undefined;
  }
  await saveBookings(bookingRepo.getAll());
  return updated;
}

async function main(): Promise<void> {
  // Load rooms, bookings, and coupons in parallel (principle 4)
  const [rooms, bookings, coupons] = await Promise.all([
    loadRooms(),
    loadBookings(),
    loadCoupons(),
  ]);
  const roomRepo = new Repository<Room>(rooms);
  const bookingRepo = new Repository<Booking>(bookings);
  const couponRepo = new Repository<Coupon>(coupons);

  const rl = Readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const line = await rl.question("> ");
    const [command, ...args] = line.trim().split(/\s+/);

    switch (command) {
      case "help":
        {
          // Format
          const formattedMsg =
            `
All commands:
  help - Show this help
  list <date> - List all bookings for a date
  book <customer> <room> <start> <hours> [coupon] - Book a room
  coupons - List available coupon codes
  confirm <id> - Confirm a booking
  cancel <id> - Cancel a booking
  available <room> <date> - Check if a room is available on a date
  revenue <date> - Show revenue for a date
  stats <date> - Show daily room usage stats for a date
  exit - Exit the application
          `;

          console.log(formattedMsg);
          break;
        }

      case "list":
        {
          // Validate argument count
          if (args.length !== 1) {
            console.log("Usage: list <date>");
            break;
          }

          const targetDate = args[0];

          // Validate date format (YYYY-MM-DD)
          if (!isValidDate(targetDate)) {
            console.log("Invalid date. Use YYYY-MM-DD.");
            break;
          }

          const bookingsForDate = bookingRepo
            .getAll()
            .filter(b => b.date == targetDate);

          // Respond the result
          console.log(`Bookings for ${targetDate}:`);
          console.log(`Total bookings: ${bookingsForDate.length}`);
          printReport(bookingsForDate, roomRepo.getAll(), couponRepo.getAll());

          break;
        }

      case "book":
        {
          // 1. Validate arguments
          if (args.length < 4 || args.length > 5) {
            console.log("Usage: book <customer> <room> <start> <hours> [coupon]");
            break;
          }

          const targetRoom = args[1];
          if (!isRoomName(targetRoom)) {
            console.log(`Unknown room. Valid rooms are: ${ROOM_NAMES.join(", ")}`);
            break;
          }

          const start = Number(args[2]);
          const hours = Number(args[3]);
          if (!isValidBookingHour(start, hours)) {
            console.log("Invalid start or hours. Must be between 0 and 23.");
            break;
          }

          const couponCode = args[4];
          const appliedCoupon = findCoupon(couponCode, couponRepo.getAll());
          if (couponCode && !appliedCoupon) {
            console.log(`Unknown coupon "${couponCode}". Use "coupons" to list valid codes.`);
            break;
          }

          const roomsList = roomRepo.getAll();
          if (appliedCoupon) {
            const couponError = validateCoupon(appliedCoupon, targetRoom, hours, roomsList);
            if (couponError) {
              console.log(couponError);
              break;
            }
          }

          const booking: Booking = {
            id: `bk-${Date.now()}`,
            room: targetRoom,
            customer: String(args[0]),
            date: DAY,
            start,
            hours,
            status: Status.Pending,
            ...(appliedCoupon ? { coupon: appliedCoupon.id } : {}),
          };

          // 2. Check if the booking is conflicting with existing bookings
          const conflictingBooking = bookingRepo
            .getAll()
            .find(
              b => b.room === booking.room
                && b.date === booking.date
                && b.start < booking.start + booking.hours
                && b.start + b.hours > booking.start
                && b.status !== Status.Cancelled
            );

          if (conflictingBooking) {
            console.log(`Conflict: ${conflictingBooking.room} is already booked for ${conflictingBooking.date} from ${time(conflictingBooking.start)} to ${time(conflictingBooking.start + conflictingBooking.hours)}`);
            break;
          }

          // 3. Add & save booking
          bookingRepo.add(booking);
          await saveBookings(bookingRepo.getAll());

          // 4. Respond the result
          const couponsList = couponRepo.getAll();
          const discount = couponDiscount(booking, roomsList, couponsList);
          const finalCost = cost(booking, roomsList, couponsList);
          const couponMsg = appliedCoupon
            ? ` (coupon ${appliedCoupon.id}: -${vnd(discount)}, total: ${vnd(finalCost)})`
            : "";
          console.log(`+ Booked: ${booking.room} ${time(booking.start)}-${time(booking.start + booking.hours)} for ${booking.customer}${couponMsg}`);
          console.log(`Saved ${bookingRepo.getAll().length} bookings to bookings.json`);

          break;
        }

      case "confirm":
        {
          // 1. Validate argument count
          if (args.length !== 1) {
            console.log("Usage: confirm <id>");
            break;
          }

          // 2. Validate booking & update status
          const bookingId = args[0];
          const updated = await updateBookingStatus(bookingRepo, bookingId, Status.Confirmed);
          if (!updated) break;

          // 3. Respond the result
          console.log(`Booking ${updated.id} confirmed`);
          console.log(`Confirmed ✔: ${updated.room} ${time(updated.start)}-${time(updated.start + updated.hours)} for ${updated.customer}`);

          break;
        }

      case "cancel":
        {
          // 1. Validate argument count
          if (args.length !== 1) {
            console.log("Usage: cancel <id>");
            break;
          }

          // 2. Validate booking & update status
          const bookingId = args[0];
          const updated = await updateBookingStatus(bookingRepo, bookingId, Status.Cancelled);
          if (!updated) break;

          // 3. Respond the result
          console.log(`Cancelled ✖ ${updated.room} ${time(updated.start)}-${time(updated.start + updated.hours)} for ${updated.customer}`);

          break;
        }

      case "available":
        {
          // 1. Validation
          // Validate argument count
          if (args.length !== 2) {
            console.log("Usage: available <room> <date>");
            break;
          }

          // Check if room is valid
          const targetRoom = args[0];
          if (!isRoomName(targetRoom)) {
            console.log(`Unknown room. Valid rooms are: ${ROOM_NAMES.join(", ")}`);
            break;
          }

          const targetDate = args[1];

          // Validate date format (YYYY-MM-DD)
          if (!isValidDate(targetDate)) {
            console.log("Invalid date. Use YYYY-MM-DD.");
            break;
          }

          // 2. Filter active bookings
          const targetBookings = bookingRepo
            .getAll()
            .filter(booking =>
              booking.date === targetDate
              && booking.room === targetRoom
              && booking.status !== Status.Cancelled
            );

          // 3. Solve availability
          // So this must be a list which shows the exact time shot from the space on the start date and increment tool
          type TimeSlot = { start: number; end: number };

          const freeSlots: TimeSlot[] = [];
          const sortedTargetBookings = targetBookings
            .sort((a, b) => a.start - b.start);

          // Plan: This require stateful value to track the end of the last booking and compare it with the start of the next booking to find free slots.
          let lastEndTime = 0; // Start of the day

          sortedTargetBookings.forEach(booking => {
            if (booking.start > lastEndTime) {
              freeSlots.push({ start: lastEndTime, end: booking.start });
            }
            lastEndTime = Math.max(lastEndTime, booking.start + booking.hours);
          });

          // Check for free slot at the end of the day
          if (lastEndTime < 24) {
            freeSlots.push({ start: lastEndTime, end: 24 });
          }

          // 4. Respond the result
          if (freeSlots.length === 0) {
            console.log(`No available slots for ${targetRoom} on ${targetDate}`);
          } else {
            console.log(`Available slots for ${targetRoom} on ${targetDate}:`);
            freeSlots.forEach(slot => {
              console.log(`- ${time(slot.start)} to ${time(slot.end)}`);
            });
          }

          break;
        }

      case "revenue":
        {
          // 1. Validation
          // Validate argument count
          if (args.length !== 1) {
            console.log("Usage: revenue <date>");
            break;
          }

          const targetDate = args[0];

          // Validate date format (YYYY-MM-DD)
          if (!isValidDate(targetDate)) {
            console.log("Invalid date. Use YYYY-MM-DD.");
            break;
          }

          // 2. Filter bookings for the target date
          const bookingsForDate = bookingRepo
            .getAll()
            .filter(b => b.date === targetDate);

          if (bookingsForDate.length === 0) {
            console.log(`No bookings found for ${targetDate}`);
            break;
          }

          // 3. Respond the result
          printReport(bookingsForDate, roomRepo.getAll(), couponRepo.getAll());

          break;
        }

      case "stats":
        {
          if (args.length !== 1) {
            console.log("Usage: stats <date>");
            break;
          }

          const targetDate = args[0];
          if (!isValidDate(targetDate)) {
            console.log("Invalid date. Use YYYY-MM-DD.");
            break;
          }

          printDailyStats(
            bookingRepo.getAll(),
            roomRepo.getAll(),
            targetDate,
            couponRepo.getAll(),
          );

          break;
        }

      case "coupons":
        {
          if (args.length !== 0) {
            console.log("Usage: coupons");
            break;
          }

          printCoupons(couponRepo.getAll());
          break;
        }

      case "exit":
        rl.close();
        process.exit(0);

      default:
        console.log("Unknown command");
    }
  }
}

main().catch((err) => {
  console.error("Something went wrong:", (err as Error).message);
  process.exitCode = 1;
});
