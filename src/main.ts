import { createInterface, Interface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Booking, Room, Status } from "./models.js";
import { Repository } from "./repository.js";
import { time } from "./report.js";
import { loadBookings, loadRooms, saveBookings } from "./storage.js";
import {
  cancelBooking,
  confirmBooking,
  ensureNoOverlap,
  listBookings,
  nextBookingId,
  parseDuration,
  parseHour,
  showAvailable,
  showHelp,
  showRevenue,
  showUsageStats,
  validateRoom,
} from "./commands.js";

async function main(): Promise<void> {
  const [rooms, bookings] = await Promise.all([
    loadRooms(),
    loadBookings(),
  ]);

  const roomRepo = new Repository<Room>(rooms);
  const bookingRepo = new Repository<Booking>(bookings);
  const rl = createInterface({ input, output });

  showHelp();

  let running = true;

  while (running) {
    const line = (await rl.question("> ")).trim();

    try {
      running = await handleCommand(
        line,
        roomRepo,
        bookingRepo,
        rl,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";

      console.error(`Error: ${message}`);
    }
  }

  rl.close();
}

async function handleCommand(
  line: string,
  rooms: Repository<Room>,
  bookings: Repository<Booking>,
  rl: Interface,
): Promise<boolean> {
  const [command, ...args] = line.split(/\s+/);

  switch (command) {
    case "":
      return true;

    case "help":
      showHelp();
      return true;

    case "list":
      if (args.length !== 1) {
        throw new Error("Usage: list <date>");
      }

      listBookings(args[0], bookings, rooms.getAll());
      return true;

    case "revenue":
      if (args.length !== 1) {
        throw new Error("Usage: revenue <date>");
      }

      showRevenue(args[0], bookings, rooms.getAll());
      return true;

    case "confirm":
      if (args.length !== 1) {
        throw new Error("Usage: confirm <id>");
      }

      confirmBooking(args[0], bookings);
      await saveBookings(bookings.getAll());
      return true;

    case "cancel":
      if (args.length !== 1) {
        throw new Error("Usage: cancel <id>");
      }

      cancelBooking(args[0], bookings);
      await saveBookings(bookings.getAll());
      return true;

    case "book":
      await createBooking(bookings, rooms.getAll(), rl);
      await saveBookings(bookings.getAll());
      return true;

    case "available":
      if (args.length !== 2) {
        throw new Error("Usage: available <room> <date>");
      }

      showAvailable(validateRoom(args[0]), args[1], bookings);
      return true;
    case "usage":
      if (args.length !== 1) {
        throw new Error("Usage: usage <date>");
      }

      showUsageStats(args[0], bookings, rooms.getAll());
      return true;

    case "exit":
      return false;

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function createBooking(
  bookings: Repository<Booking>,
  rooms: Room[],
  rl: Interface,
): Promise<void> {
  const customer = (await rl.question("Customer: ")).trim();
  const roomText = (await rl.question("Room: ")).trim();
  const date = (await rl.question("Date (YYYY-MM-DD): ")).trim();
  const startText = (await rl.question("Start hour: ")).trim();
  const hoursText = (await rl.question("Duration (hours): ")).trim();

  if (!customer) {
    throw new Error("Customer is required.");
  }

  const room = validateRoom(roomText);
  const start = parseHour(startText);
  const hours = parseDuration(hoursText);

  if (start + hours > 24) {
    throw new Error("Booking must finish by 24:00.");
  }

  if (!rooms.some((item) => item.id === room)) {
    throw new Error(`Unknown room: ${room}`);
  }

  const booking: Booking = {
    id: nextBookingId(bookings),
    room,
    customer,
    date,
    start,
    hours,
    status: Status.Pending,
  };

  ensureNoOverlap(booking, bookings);
  bookings.add(booking);

  console.log(`Booked ${booking.id}: ${room} ${time(start)}-${time(start + hours)} for ${customer}`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown error";

  console.error("Something went wrong:", message);
  process.exitCode = 1;
});