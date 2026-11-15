import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadBookings, loadRooms, saveBookings } from "./storage.js";
import { Repository } from "./repository.js";
import { Booking, Room, Status } from "./models.js";
import { cost, hasConflict, printReport, vnd, time, clashWith } from "./report.js";
const r1 = readline.createInterface({ input, output });
let running = true;
const [rooms, bookings] = await Promise.all([
    loadRooms(),
    loadBookings(),
]);
const roomRepo = new Repository<Room>(rooms);
const bookingRepo = new Repository<Booking>(bookings);
async function book(args: string[]): Promise<void> {
    if (args.length !== 5) {
        throw new Error("Usage: book <customer> <room> <date> <start> <hours>");
    }
    const [customer, roomName, date, startText, hoursText] = args;
    if (!customer || !roomName || !date || !startText || !hoursText) {
        throw new Error("Missing booking details");
    }
    const room = roomRepo.findById(roomName);
    if (!room) {
        throw new Error(`Unknown room "${roomName}"`);
    }
    const start = Number(startText);
    const hours = Number(hoursText);
    if (!Number.isInteger(start) || !Number.isInteger(hours)) {
        throw new Error("Start and hours must be integers");
    }
    if (start < 0 || start > 23 || hours < 1 || start + hours > 24) {
        throw new Error("Invalid time range");
    }
    const newBooking: Booking = {
        id: `bk-${Date.now()}`,
        room: room.id,
        customer,
        date,
        start,
        hours,
        status: Status.Pending,
    };

    if (hasConflict(newBooking, bookingRepo.getAll())) {
        throw new Error("Room is already booked");
    }
    bookingRepo.add(newBooking);
    await saveBookings(bookingRepo.getAll());
    console.log(`✔ Booked ${newBooking.id}`);
}
async function confirm(args: string[]): Promise<void> {
    const id = args[0];
    if (!id) {
        throw new Error("Usage: confirm <id>");
    }
    const booking = bookingRepo.findById(id);
    if (!booking) {
        throw new Error(`No booking with id "${id}"`);
    }
    if (booking.status !== Status.Pending) {
        throw new Error(`${id} is not pending`);
    }
    bookingRepo.update(id, { status: Status.Confirmed });
    await saveBookings(bookingRepo.getAll());

    console.log(`✔ Confirmed ${id}`);
}
async function cancel(args: string[]): Promise<void> {
    const id = args[0];
    if (!id) {
        throw new Error("Usage: cancel <id>");
    }
    const booking = bookingRepo.findById(id);
    if (!booking) {
        throw new Error(`No booking with id "${id}"`);
    }

    if (booking.status === Status.Cancelled) {
        throw new Error(`${id} is already cancelled`);
    }
    bookingRepo.update(id, { status: Status.Cancelled });
    await saveBookings(bookingRepo.getAll());

    console.log(`✖ Cancelled ${id}`);
}
function suggest(args: string[]): void {
    if (args.length !== 4) {
        throw new Error("Usage: suggest <room> <date> <start> <hours>")
    }
    const [roomName, date, startText, hoursText] = args;
    if (!roomName || !date || !startText || !hoursText) {
        throw new Error("Missing suggestion details");
    }
    const room = roomRepo.findById(roomName);
    if (!room) {
        throw new Error(`Unknown room "${roomName}"`);
    }
    const desiredStart = Number(startText);
    const hours = Number(hoursText);

    if (!Number.isInteger(desiredStart) || !Number.isInteger(hours)) {
        throw new Error("Start and hours must be integers");
    }
    if (desiredStart < 0 || desiredStart > 23 || hours < 1 || hours > 24) {
        throw new Error("Invalid time range");
    }
    const busy = bookingRepo.getAll().filter((booking) =>booking.room === room.id &&booking.date === date &&booking.status !== Status.Cancelled);
    const candidateStarts = Array.from(
        { length: 25 - hours },
        (_, start) => start
    ).sort((a, b) =>Math.abs(a - desiredStart) - Math.abs(b - desiredStart) ||a - b);
    const suggestedStart = candidateStarts.find((start) =>!busy.some((booking) =>start < booking.start + booking.hours &&booking.start < start + hours));
    if (suggestedStart === undefined) {
        console.log("No free slot for that duration");
    } else {
        console.log(
            `Nearest free slot: ${time(suggestedStart)}-${time(suggestedStart + hours)}`
        );
    }
}
function stats(args: string[]): void {
    const date = args[0];
    if (!date) {
        throw new Error("Usage: stats <date>");
    }
    const bookingsForDate = bookingRepo
        .getAll()
        .filter(
            (booking) =>
                booking.date === date && booking.status !== Status.Cancelled
        );
    const validBookings = bookingsForDate.filter(
        (booking) => !clashWith(booking, bookingsForDate)
    );
    const lines = roomRepo.getAll().map((room) => {
        const hours = validBookings
            .filter((booking) => booking.room === room.id)
            .reduce((total, booking) => total + booking.hours, 0);
        return `  ${room.id}: ${hours} hour(s)`;
    });
    console.log(`Room usage on ${date}:\n${lines.join("\n")}`);
}
while (running) {
    try {
        const line = await r1.question("> ");
        const [command = "", ...args] = line.trim().split(/\s+/);
        if (command === "exit") {
            running = false;
        } else if (command === "help") {
            console.log("Commands: help, list, book, confirm, cancel, available, suggest, stats, revenue, exit");
        } else if (command === "list") {
            const date = args[0];
            if (!date) {
                console.log("Usage : list <date>");
            } else {
                const bookingsForDate = bookingRepo.getAll().filter((booking) => booking.date === date);
                console.log(`Booking for ${date} (${bookingsForDate.length})`);
                printReport(bookingsForDate, roomRepo.getAll());
            }
        } else if (command === "revenue") {
            const date = args[0];

            if (!date) {
                console.log("Usage: revenue <date>");
            } else {
                const bookingsForDate = bookingRepo.getAll().filter((booking) => booking.date === date);
                const confirmed = bookingsForDate.filter((booking) => booking.status === Status.Confirmed &&!clashWith(booking, bookingsForDate));
                const amounts = confirmed.map((booking) => cost(booking, rooms));
                const total = amounts.reduce((sum, amount) => sum + amount, 0);

                console.log(`Revenue on ${date}: ${vnd(total)}`);
            }
        } else if (command === "available") {
            const [room, date] = args;

            if (!room || !date) {
                console.log("Usage: available <room> <date>");
            } else if (!roomRepo.findById(room)) {
                console.log(`Unknown room "${room}"`);
            } else {
                const busy = bookingRepo.getAll().filter((booking) =>booking.room === room &&booking.date === date && booking.status !== Status.Cancelled);
                const allHours = Array.from({ length: 24 }, (_, hour) => hour);
                const freeHours = allHours.filter((hour) =>!busy.some((booking) => hour >= booking.start &&hour < booking.start + booking.hours));
                console.log(freeHours.map(time).join(", ") || "No free hours");
            }
        } else if (command === "book") {
            await book(args);
        } else if (command === "confirm") {
            await confirm(args);
        }
        else if (command === "cancel") {
            await cancel(args);
        }
        else if (command === "suggest") {
            suggest(args);
        } else if (command === "stats") {
            stats(args);
        } else if (command !== "") {
            console.log(`Unknown command "${command}"`);
        }
    } catch (err) {
        console.log("Error:", (err as Error).message);
    }
}
r1.close();
