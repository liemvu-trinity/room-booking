import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Booking, Room, RoomName, Status } from "./models.js";
import { Repository } from "./repository.js";
import { overlaps, listDate, roomUsage, time, venueReport, vnd } from "./report.js";
import { loadBookings, loadRooms, saveBookings } from "./storage.js";

const DAY = "2026-11-12";
const ROOM_NAMES: RoomName[] = ["Sky", "Ocean", "Forest"];

// A type guard: checks at run time that a string really is a RoomName.
function isRoomName(value: string | undefined): value is RoomName {
  return ROOM_NAMES.includes(value as RoomName);
}

async function main(): Promise<void> {
  // Two files, loaded at the same time (principle 4)
  const [rooms, bookings] = await Promise.all([loadRooms(), loadBookings()]);
  const roomRepo = new Repository<Room>(rooms);
  const bookingRepo = new Repository<Booking>(bookings);

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    while (true) {
      const input = (await rl.question("> ")).trim();
      const [command, ...args] = input.split(/\s+/);
      if (command === "help") {
        console.log("Commands: help, list <date>, book, confirm <id>, cancel <id>, available <room> <date>, revenue <date>, exit");
        console.log("Currently supported: help, list <date>, stats <date>, revenue <date>, confirm <id>, cancel <id>, book, exit");
      }
      else if (command === "exit") {
        break;
      }
      else if (command === "list") {
        const date = args[0];
        if (args.length !== 1 || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
          console.log("Usage: list <date> (YYYY-MM-DD), e.g. list 2026-11-12");
          continue;
        }
        const list = listDate(bookingRepo.getAll(), date);
        if (list.length === 0) {
          console.log(`No bookings found for ${date}`);
        } else {
          console.log(`Bookings for ${date} (${list.length})`);
          console.table(list);
        }
      }
      else if (command === "stats") {
        const date = args[0];
        if (args.length !== 1 || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
          console.log("Usage: stats <date> (YYYY-MM-DD), e.g. stats 2026-11-12");
          continue;
        }
        console.log(`Confirmed room bookings for ${date}`);
        roomRepo.getAll().forEach((room) => {
          roomUsage(bookingRepo.getAll(), date, room.id, roomRepo.getAll());
        });
      }
      else if (command === "revenue") {
        const date = args[0];
        if (args.length !== 1 || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
          console.log("Usage: revenue <date> (YYYY-MM-DD), e.g. revenue 2026-11-12");
          continue;
        }
        const revenue = venueReport(bookingRepo.getAll(), date, roomRepo.getAll());
        console.log(`Revenue (confirmed) for ${date}: ${vnd(revenue)}`);
      }
      else if (command === "confirm") {
        const id = args[0];
        if (args.length !== 1 || !id) {
          console.log("Usage: confirm <id>");
          continue;
        }
        try {
          await confirmBooking(bookingRepo, id);
          console.log(`Xác nhận thành công booking ${id}`);
        } catch (err) {
          console.error("Confirmation failed:", (err as Error).message);
        }
      }
      else if (command === "cancel") {
        const id = args[0];
        if (args.length !== 1 || !id) {
          console.log("Usage: cancel <id>");
          continue;
        }
        try {
          await cancelBooking(bookingRepo, id);
          console.log(`Hủy thành công booking ${id}`);
        } catch (err) {
          console.error("Cancellation failed:", (err as Error).message);
        }
      }
      else if (command === "book") {
        try {
          if (args.length !== 4) {
            throw new Error("Usage: book <customer> <room> <start> <hours>");
          }
          const [customer, room, start, hours] = args;
          if (customer) {
            if (!isRoomName(room)) throw new Error(`Unknown room: ${room}`);
            const booking: Booking = {
              id: `bk-${Date.now()}`,
              room,
              customer,
              date: DAY,
              start: Number(start),
              hours: Number(hours),
              status: Status.Pending,
            };
            if (!Number.isInteger(booking.start) || !Number.isInteger(booking.hours)) {
              throw new Error("start and hours must be whole numbers");
            }
            const bookings: Booking[] = bookingRepo.getAll()
            for (const b of bookings) {
              if (b.status !== Status.Cancelled && overlaps(b, booking)) {
                throw new Error("Phòng đã có booking trùng lịch");
              }
            }
            bookingRepo.add(booking);
            await saveBookings(bookingRepo.getAll());
            console.log(`+ Booked: ${room} ${time(booking.start)}-${time(booking.start + booking.hours)} for ${customer}`);
            console.log(`Saved ${bookingRepo.getAll().length} bookings to bookings.json`);
          }

        } catch (err) {
          console.error("Booking failed:", (err as Error).message);
        }
      }
      else {
        console.log("Unknown command. Type help for commands.");
      }
    }
  } finally {
    rl.close();
  }
}

async function confirmBooking(bookingRepo: Repository<Booking>, id: string): Promise<void> {
  const booking = bookingRepo.findById(id);
  if (!booking) throw new Error(`Booking not found: ${id}`);

  const clash = bookingRepo.getAll().find((other) =>
    other.id !== booking.id && other.status !== Status.Cancelled && overlaps(other, booking)
  );
  if (clash) throw new Error("Phòng đã có booking trùng lịch");

  const previousStatus = booking.status;
  try {
    booking.status = Status.Confirmed;
    await saveBookings(bookingRepo.getAll());
  } catch (err) {
    booking.status = previousStatus;
    throw err;
  }
}

async function cancelBooking(bookingRepo: Repository<Booking>, id: string): Promise<void> {
  const booking = bookingRepo.findById(id);
  if (!booking) throw new Error(`Booking not found: ${id}`);

  const previousStatus = booking.status;
  try {
    booking.status = Status.Cancelled;
    await saveBookings(bookingRepo.getAll());
  } catch (err) {
    booking.status = previousStatus;
    throw err;
  }
}

main().catch((err) => {
  console.error("Something went wrong:", (err as Error).message);
  process.exitCode = 1;
});

