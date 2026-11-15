import { Booking, RoomName, Status } from "./models.js";
import { Repository } from "./repository.js";
import { overlaps } from "./report.js";
import { Room } from "./models.js";
import { cost, printReport, time, vnd } from "./report.js";

const ROOM_NAMES: RoomName[] =["Sky", "Ocean", "Forest"];

export function isRoomName(value: string): value is RoomName {
    return ROOM_NAMES.includes(value as RoomName);
}

export function parseHour(value: string): number {
    const hour = Number(value);

    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        throw new Error(`Hour must be an integer between 0 and 23`);
    }

    return hour;
}

export function parseDuration(value: string): number {
    const hours = Number(value);

    if (!Number.isInteger(hours) || hours <= 0) {
        throw new Error(`Duration must be a positive integer`);
    }

    return hours;
}

export function validateRoom(value: string): RoomName {
    if (!isRoomName(value)) {
        throw new Error(`Invalid room name: ${value}`);
    }

    return value;
}

export function ensureNoOverlap(candidate: Booking, bookings: Repository<Booking>): void {
    const conflict = bookings.getAll().find((existing) => existing.id !== candidate.id && existing.status !== Status.Cancelled && overlaps(existing, candidate));

    if (conflict) {
        throw new Error(`Double booking rejected. Booking overlaps with existing booking: ${conflict.id} (${conflict.customer})`);
    }
}

export function showHelp(): void {
    console.log('Commands: help, list <date>, book, confirm <id>, cancel <id>, available <room> <date>, revenue <date>, usage <date>, exit');
}

export function listBookings(date: string, bookings: Repository<Booking>, rooms: Room[]): void {
    const matching = bookings.getAll().filter((booking) => booking.date === date);

    console.log(`Bookings for ${date}:`);

    if (matching.length === 0) {
        console.log('No bookings found.');

        return;
    }

    printReport(matching, rooms);
}

export function showRevenue(date: string, bookings: Repository<Booking>, rooms: Room[]): void {
    const revenue = bookings.getAll().filter((booking) => booking.date === date && booking.status === Status.Confirmed).map((booking) => cost(booking, rooms)).reduce((total, amount) => total + amount, 0);

    console.log(`Revenue for ${date}: ${vnd(revenue)}`);
}

export function confirmBooking(id: string, bookings: Repository<Booking>): void {
    const booking = bookings.findById(id);

    if (!booking) {
        throw new Error(`Booking with ID ${id} not found`);
    }

    if (booking.status === Status.Cancelled) {
        throw new Error(`Booking with ID ${id} is already cancelled`);
    }

    ensureNoOverlap(booking, bookings);

    bookings.update({ ...booking, status: Status.Confirmed });

    console.log(`Booking with ID ${id} has been confirmed`);
}

export function cancelBooking(id: string, bookings: Repository<Booking>): void {
    const booking = bookings.findById(id);

    if (!booking) {
        throw new Error(`Booking with ID ${id} not found`);
    }

    if (booking.status === Status.Cancelled) {
        throw new Error(`Booking with ID ${id} is already cancelled`);
    }

    bookings.update({ ...booking, status: Status.Cancelled });

    console.log(`Booking with ID ${id} has been cancelled`);
}

export function showAvailable(room: RoomName, date: string, bookings: Repository<Booking>): void {
    const occupied = bookings.getAll().filter((booking) => booking.room === room && booking.date === date && booking.status !== Status.Cancelled).flatMap((booking) => Array.from({ length: booking.hours }, (_, i) => booking.start + i));

    const available = Array.from({ length: 24 }, (_, i) => i).filter((hour) => !occupied.includes(hour));

    console.log(`Available hours for room ${room} on ${date}: ${available.map(time).join(', ')}`);
}

export function showUsageStats(date: string, bookings: Repository<Booking>, rooms: Room[],): void {
  console.log(`Room usage for ${date}:`);

  rooms.forEach((room) => {const usedHours = bookings.getAll().filter((booking) => booking.room === room.id && booking.date === date && booking.status !== Status.Cancelled).map((booking) => booking.hours).reduce((total, hours) => total + hours, 0);

    console.log(`  ${room.id}: ${usedHours} hours used`);
  });
}

export function nextBookingId(bookings: Repository<Booking>): string {const highestId = bookings.getAll().map((booking) => {
        const match = /^bk(\d+)$/.exec(booking.id);
        return match ? Number(match[1]) : 0;
    }).reduce((highest, current) => Math.max(highest, current), 0);

  return `bk${highestId + 1}`;
}