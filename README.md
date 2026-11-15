# Room Booking · TypeScript Core & Node Runtime

A small app for managing meeting room bookings. It reads the rooms and bookings from JSON files,
prices each booking by the hour, adds up the revenue from confirmed bookings,
warns about overlapping bookings, and lets you add a booking from the command line.
This is the app we open up piece by piece during the training session.

Step-by-step setup guide: [SETUP.md](SETUP.md).

```text
$ npm start -- Trang Ocean 16 2
+ Booked: Ocean 16:00-18:00 for Trang
Saved 6 bookings to bookings.json
Bookings for 2026-11-12 (6)
  ✔ 09:00-11:00  Sky    Liam   400,000 VND
  ✔ 10:00-12:00  Sky    Minh   400,000 VND  ⚠ overlaps Liam
  ○ 13:00-14:00  Ocean  Lan    150,000 VND
  ✔ 14:00-17:00  Forest Huy    900,000 VND
  ✖ 15:00-16:00  Ocean  An     150,000 VND
  ✔ 16:00-18:00  Ocean  Trang  300,000 VND
Revenue (confirmed): 2,000,000 VND
⚠ 1 conflict(s) found
```

`✔` confirmed · `○` pending · `✖` cancelled.

## Requirements

- Node.js LTS (20 or newer)
- Git

## Install and run

```bash
npm install
npm run dev        # run the .ts files directly (while coding)
npm run check      # type-check only, no output files
npm run build      # compile .ts → .js into dist/
npm start          # run the compiled app
npm run reset      # put bookings.json back to the 5 original bookings
```

Add a booking from the command line (customer, room, start hour, hours):

```bash
npm start -- Trang Ocean 16 2
npm start -- Khoa Sky 9 1      # overlaps Liam: the app still books it, it only warns
```

For now the app only **warns** about overlapping bookings; it doesn't **block** them. That's the homework. Run `npm run reset` to go back to the original data.

## Structure

| File | Role |
| --- | --- |
| `src/models.ts` | Describes the data: `Booking`, `Room`, `RoomName`, `Status` |
| `src/repository.ts` | Data store: `Repository<T>`, used for both `Room` and `Booking` |
| `src/report.ts` | Prices, revenue (filter → map → reduce), overlap detection |
| `src/storage.ts` | Reads two files in parallel with `Promise.all`, writes with `async/await` |
| `src/main.ts` | Entry point |
| `src/demo/` | TypeScript demos (slides 9–11) |
| `src/lab/` | Node demos (slides 16–23) |
| `demos/` | JavaScript demos (`js-basics.js`, `bug.js`) |
| `rooms.json`, `bookings.json` | Data; `data/bookings.seed.json` is the original copy |
| `scripts/reset.mjs` | Resets the data |

## Demos by slide

Every demo runs on this exact version of the code; no need to check out older commits. For the TypeScript demos (slides 9–11), make one change at a time, look at the red underline and `npm run check`, then undo it:

- `src/demo/types.ts`: uncomment the line `addRevenue(400000, "900000")`.
- `src/demo/booking.ts`: try the 4 changes listed at the top of the file, or uncomment `console.log(found.customer)`.
- `src/demo/private.ts`: add the line `bookingRepo.items = [];` or `bookingRepo.add(roomRepo.getAll()[0]);`.

| Slide | Command or file | What you see |
| --- | --- | --- |
| 2 | `npm run reset`, `npm start`, `npm start -- Trang Ocean 16 2`, `npm start -- Khoa Sky 9 1` | The schedule, a new booking, an overlapping booking that only gets a warning |
| 6 | `npm run demo:js` | Three things to know about JavaScript |
| 7 | `npm run demo:bug` | The 400 billion bug: `400000900000 string` |
| 9 | `src/demo/types.ts` + `npm run check`, `npm run build` | Red underline on a wrong type; `dist/demo/types.js` has no types left |
| 10 | `src/demo/booking.ts` + `npm run check` | Room `"Moon"`, start `"09:00"`, a missing field, `found` possibly `undefined` |
| 11 | `src/demo/private.ts` + `npm run check` | `items` is private; a `Room` is not a `Booking` |
| 12 | `npm start` | Revenue with filter → map → reduce |
| 16 | `npm run lab:thread` | Principle 1: one thread (stop with Ctrl+C) |
| 17 | `npm run lab:wait` | Principle 2: waiting is handed to libuv |
| 18 | `npm run lab:queue` | Principle 3: results wait in line, run when V8 is free |
| 19 | `npm run lab:parallel` | Principle 4: A 3 s, B 1 s, C 3 s |
| 20 | `npm run lab:promise`, `npm run lab:pending` | Principle 5: `Promise { <pending> }`, in the app too |
| 21 | `npm run lab:await` | `await` pauses only the function: A, B, C, D |
| 22 | `npm run lab:fail` | With a catcher the program goes on; without one, Node stops |
| 23 | `npm run lab:nocatch`; rename `bookings.json`; break the JSON; `"start": "9"` | The error without `try/catch`, then how the app handles each kind of failure |
| Backup | `npm run lab:order` | Promises jump ahead of timers: 1, 4, 3, 2 |

After renaming the file, breaking the JSON or adding bookings, run `npm run reset` to put `bookings.json` back to the 5 original bookings.

## Homework: Booking Manager

Turn the app into a booking program that keeps running and takes commands from the user.

**Must have (60 points)**

- Commands: `help`, `list <date>`, `book`, `confirm <id>`, `cancel <id>`, `available <room> <date>`, `revenue <date>`, `exit`
- **Reject double bookings**: don't allow a booking that overlaps a non-cancelled booking of the same room
- `Repository<T>` gets `update` and `remove`; the data stays `private`
- Revenue and lists use array methods, no `for` loops
- Read and write files with `fs/promises` and `await`, no `*Sync` functions
- Bad input (invalid hour, unknown room, wrong id): a clear error message, and the program keeps running
- `strict` on, no `any`, sensible modules

Hint: look at `node:readline/promises`. `rl.question()` returns a Promise.

**Creative (25 points):** pick at least 2 challenges, or propose your own, and explain your design in the README:
peak-hour pricing, weekly repeating bookings, a waitlist when a room is full, suggesting the nearest free slot,
daily room usage stats, exporting the schedule to Markdown/CSV, validating the JSON data with a type guard.

**Think (15 points), answer in the README:**

1. Change `"start": 9` in `bookings.json` to `"9"` and the app prints `09:00-92:00`, with no TypeScript error. Why? How would you handle it?
2. With 1 million bookings, where is the overlap check slow? What is V8 doing at that moment?
3. Two terminals book the same room, at the same time, and save the file at the same moment. What happens?

### How to submit

```bash
git checkout -b homework/<your-name>
# do the work, commit small and often
git push origin homework/<your-name>
```

Open a Pull Request titled `[Homework] <Full name>` and list the creative challenges you chose.

## Creative Challenges

### 1. Peak-Hour Pricing

**Design:**

The booking system supports dynamic pricing based on peak hours. Instead of applying a higher price to the entire booking, the system only applies the peak-hour multiplier to the hours that overlap with the configured peak period.

For this implementation, the peak period is configured from 18:00 to 20:00, with a pricing multiplier of 1.5x.

**Implementation:**

- Define a `PEAK_HOURS` configuration containing the start time, end time, and pricing multiplier.
- Calculate the number of hours overlapping between a booking and the peak period using `calculatePeakHour()`.
- Calculate normal hours by subtracting peak hours from the total booking duration.
- Calculate the final cost by combining the normal-hour cost and peak-hour cost.

The pricing formula is:

```text
Normal Hours = Total Booking Hours - Peak Hours

Total Cost = Hourly Price × (Normal Hours + Peak Hours × Multiplier)
```

**Example:**

Assume a room costs 100,000 VND per hour, and the peak period is from 18:00 to 20:00.

A booking from 17:00 to 21:00 has:
- 2 normal hours (17:00–18:00 and 20:00–21:00).
- 2 peak hours (18:00–20:00).

The total cost is:

```text
100,000 × (2 + 2 × 1.5) = 500,000 VND
```

This approach ensures that only the overlapping hours receive the higher rate, rather than charging the peak-hour price for the entire booking.

### 2. Daily Room Usage Statistics

**Design:**

The system provides daily room usage statistics to show how much each room is utilized on a specific date.

Instead of calculating usage for only one room, the function processes all available rooms and returns their usage information for the requested date.

**Implementation:**

The `getDailyRoomUsage()` function receives the booking repository, room repository, and target date.

For each room, the function:

1. Retrieves bookings belonging to that room on the requested date.
2. Filters out bookings that are not `Confirmed` or belong to another date.
3. Calculates the total booked hours using `reduce()`.
4. Calculates the room usage percentage based on 24 hours.
5. Returns the room information together with its usage statistics.

The usage percentage is calculated using:

```text
Usage Percentage = (Total Confirmed Booking Hours / 24) × 100
```

**Example:**

If a room has 6 confirmed booking hours on a particular day:

```text
Usage Percentage = (6 / 24) × 100 = 25%
```

The result includes the room information, date, total booked hours, and usage percentage.

This feature helps identify room utilization levels and provides useful information for analyzing daily room usage.
### Think
## 1. What happens if I change `"start": 9` to `"start": "9"` in `bookings.json`? Why doesn't TypeScript catch this error?

TypeScript only checks types at compile time. It does not automatically validate data loaded from JSON files at runtime.

When the application reads the JSON file, `JSON.parse()` returns JavaScript values. If the parsed data is assigned to a TypeScript type using a type assertion such as `as Booking[]`, TypeScript trusts that assertion without checking the actual data.

As a result, `"9"` remains a string. When JavaScript evaluates `"9" + 2`, it performs string concatenation and returns `"92"` instead of performing numeric addition. This can lead to unexpected output such as `09:00-92:00`.

To prevent this, the application should validate external data at runtime before using it. For example, it can check that `start` is a number and that it is within the valid range.

## 2. If there are 1 million bookings, where will the overlap check become slow? What is V8 doing?

The main performance bottleneck is the `clashWith()` function in `report.ts`.

The slow part is clashWith() in report.ts. Every call does three things: indexOf to find where the current booking sits in the array, slice to copy out everything before it, and find to look through that copy for a clash. The problem is that it runs once per booking, and printReport calls it a second time when it counts conflicts, so the whole thing happens twice.

When nothing clashes, find has to scan the entire earlier part of the array before giving up. Booking number k scans k items, so the total adds up to about n²/2. With n = 1 million, that’s roughly 500 billion comparisons. On top of that, each slice allocates a new array, so memory use goes up and the garbage collector has to keep cleaning behind us.

As for V8, it runs JavaScript synchronously on a single main thread. While this loop is running, the event loop is blocked, so the program just freezes until it finishes.

My fix would be to group bookings by room and date using a Map, sort each group by start time, and scan each one once. After sorting, I only need to compare a booking with the one right before it: if its start is earlier than the previous one’s end, they overlap. The ones further back don’t matter, because they start even earlier, so any clash with them would already have been caught.

For the complexity: grouping with a Map is O(n), sorting all the groups adds up to at most O(n log n), and the scan is O(n). Sorting is the biggest piece, so the total is O(n log n). For 1 million bookings that’s about 20 million operations instead of 500 billion, around 25,000 times faster. I’d also compute the conflicts once and reuse the result instead of doing it twice.
## 3. Two terminals book the same room, at the same time, and save the file at the same moment. What happens?
Each terminal runs as its own process, and each one keeps its own copy of the bookings in memory. They don’t talk to each other, so neither one can see what the other is doing.

Here’s how it goes wrong. Terminal A and Terminal B both load bookings.json. Both check whether the room is free at the time they want, and both see that it is, because neither has saved anything yet. Both create a booking and write their own version of the array back to the file.

This is a race condition, and it can end in two ways. The first is a lost update: whoever writes last overwrites the other one’s booking, so one customer thinks they have a room and the file says otherwise. The second is that both bookings end up saved and overlap, if the writes happen to merge in the wrong order. There’s also a smaller risk: if the program crashes halfway through writing the file, the JSON can be left corrupted.

There are a few ways to deal with it:
- FILE locking: only one process at a time can do a read, check, write sequence. After getting the lock, the process has to reload the file first, otherwise it’s still working with old data.
- Move to a database like PostgreSQL. Use transactions, and add an exclusion constraint on room and time range, so the database itself rejects an overlapping booking