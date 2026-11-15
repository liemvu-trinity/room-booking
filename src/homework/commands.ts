import { Booking, Room, Status } from "../models.js";
import { Repository } from "../repository.js";
import { findConflict, Revenue, time, vnd } from "../report.js";
import { saveBookings } from "../storage.js";

type CommandInfo = { command: string; description: string };
type TimeRange = { from: number; to: number };
const commands: CommandInfo[] = [
    { command: "help", description: "Show all available commands" },
    { command: "list <date>", description: "List bookings by date" },
    { command: "book", description: "Create a new booking" },
    { command: "confirm <id>", description: "Confirm a booking" },
    { command: "cancel <id>", description: "Cancel a booking" },
    { command: "available <room> <date>", description: "Check room availability" },
    { command: "revenue <date>", description: "Calculate revenue by date" },
    { command: "exit", description: "Exit the application" },
];

enum Command { Help = "help", List = "list", Book = "book", Confirm = "confirm", Cancel = "cancel", Available = "available", Revenue = "revenue", Exit = "exit" }

type Prompt = { question(message: string): Promise<string>; close?(): void };

export function validateDate(date: string): boolean {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.toISOString().slice(0, 10) === date;
}

function requireDate(value: string | undefined): string {
    if (!value) throw new Error("Date is required");
    if (!validateDate(value)) throw new Error("Date must use format YYYY-MM-DD");
    return value;
}
export async function listCommand(date: string, bookingRepo: Repository<Booking>): Promise<Booking[]> {
    return bookingRepo.getAll().filter((booking) => booking.date === date);
}

async function changeStatus(
    id: string,
    next: Status.Confirmed | Status.Cancelled,
    bookingRepo: Repository<Booking>
): Promise<void> {
    if (!id) throw new Error("Booking ID is required");

    const booking = bookingRepo.findById(id);
    if (!booking) throw new Error(`Booking with ID ${id} not found`);
    if (booking.status === Status.Cancelled) throw new Error(`Booking ${id} was already cancelled`);
    if (booking.status === next) throw new Error(`Booking ${id} is already ${next}`);

    bookingRepo.updateById(id, { status: next });
    await saveBookings(bookingRepo.getAll());
    console.log(`Booking ${id} ${next}`);
}

export const confirmCommand = (id: string, repo: Repository<Booking>) =>
    changeStatus(id, Status.Confirmed, repo);

export const cancelCommand = (id: string, repo: Repository<Booking>) =>
    changeStatus(id, Status.Cancelled, repo);

export async function bookCommand(prompt: Prompt, bookingRepo: Repository<Booking>, rooms: Room[]): Promise<void> {
    const customer = (await prompt.question("Customer: ")).trim();
    const roomInput = (await prompt.question("Room: ")).trim();
    const date = (await prompt.question("Date (YYYY-MM-DD): ")).trim();
    const startInput = (await prompt.question("Start hour: ")).trim();
    const hoursInput = (await prompt.question("Number of hours: ")).trim();
    if (!customer) throw new Error("Customer is required");
    const room = rooms.find((item) => item.id === roomInput)?.id;
    if (!room) throw new Error(`Unknown room: ${roomInput}`);
    if (!validateDate(date)) throw new Error("Date must use format YYYY-MM-DD");
    const start = Number(startInput);
    const hours = Number(hoursInput);
    if (!Number.isInteger(start) || !Number.isInteger(hours) || start < 0 || start > 23 || hours < 1 || start + hours > 24) {
        throw new Error("Invalid time: start must be 0-23 and booking must end by 24:00");
    }
    const booking: Booking = { id: `bk-${Date.now()}`, customer, room, date, start, hours, status: Status.Pending };
    const conflict = findConflict(booking, bookingRepo.getAll());
    if (conflict) throw new Error(`Room ${room} overlaps with ${conflict.customer}'s booking`);
    bookingRepo.add(booking);
    await saveBookings(bookingRepo.getAll());
    console.log(`Booking created: ${booking.id}`);
    console.log(`Status: ${booking.status}`);
}

function helpCommand(): void {
    console.log("Available commands:");
    commands.forEach((command) => console.log(`- ${command.command}: ${command.description}`));
}


function availableSlots(
    room: Room,
    date: string,
    bookings: Booking[]
): TimeRange[] {
    const busy = new Set<number>();

    for (const b of bookings) {
        if (b.room !== room.id) continue;
        if (b.date !== date) continue;
        if (b.status === Status.Cancelled) continue;

        for (let h = b.start; h < b.start + b.hours; h++) {
            busy.add(h);
        }
    }

    const ranges: TimeRange[] = [];

    for (let h = 0; h < 24; h++) {
        if (busy.has(h)) continue;

        const last = ranges[ranges.length - 1];
        if (last && last.to === h) {
            last.to = h + 1;
        } else {
            ranges.push({ from: h, to: h + 1 });
        }
    }

    return ranges;
}


export async function runCommands(prompt: Prompt, bookingRepo: Repository<Booking>, roomRepo: Repository<Room>): Promise<void> {
    let running = true;
    while (running) {
        const input = (await prompt.question("> ")).trim();
        const parts = input.split(" ").filter((part) => part !== "");
        const command = (parts[0] ?? "").toLowerCase();
        const args = parts.slice(1);
        try {
            switch (command) {
                case Command.Help:
                    helpCommand();
                    break;
                case Command.List: {
                    const date = requireDate(args[0]);
                    const bookings = await listCommand(date, bookingRepo);
                    console.log(bookings.length ? bookings : `No bookings for ${date}`);
                    break;
                }
                case Command.Book:
                    await bookCommand(prompt, bookingRepo, roomRepo.getAll());
                    break;
                case Command.Confirm:
                    await confirmCommand(args[0], bookingRepo);
                    break;
                case Command.Cancel:
                    await cancelCommand(args[0], bookingRepo);
                    break;
                case Command.Available: {
                    const room = roomRepo.findById(args[0]);
                    if (!room) throw new Error(`Unknown room: ${args[0]}`);
                    const date = requireDate(args[1]);
                    const slots = availableSlots(room, date, bookingRepo.getAll());
                    console.log(
                        slots.length
                            ? slots.map((slot) => `${time(slot.from)} - ${time(slot.to)}`).join(", ")
                            : "No available time slots"
                    );
                    break;
                }
                case Command.Revenue: {
                    const date = requireDate(args[0]);
                    const amount = Revenue(bookingRepo.getAll(), roomRepo.getAll(), date);
                    console.log(`Revenue for ${date}: ${vnd(amount)}`);
                    break;
                }
                case Command.Exit:
                    running = false;
                    break;
                case "":
                    break;
                default:
                    throw new Error(`Unknown command: ${command}`);
            }
        } catch (error) {
            console.error((error as Error).message);
        }
    }
    prompt.close?.();
}
