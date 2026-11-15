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

## Creative challenges

### Nearest free slot suggestion
The `suggest <room> <date> <start> <hours>` command finds the nearest available time slot for a room and date. If two slots are equally close, it chooses the earlier one. Cancelled bookings do not block a suggested slot.

### Daily room usage stats
The `stats <date>` command shows the number of booked hours for each room on that date. It excludes cancelled bookings and later bookings that overlap an earlier non-cancelled booking.

**Think (15 points), answer in the README:**
Why can "start": "9" print 09:00-92:00 without a TypeScript error? How would you handle it?
TypeScript checks the types used in the source code, but it does not validate JSON data at runtime. JSON.parse() can return a booking whose start is actually the string "9", even if the code uses a type assertion such as as Booking[]. In JavaScript, adding the string "9" to the number 2 produces the string "92", which the time formatter then displays as 92:00. I would parse the JSON as unknown and validate each booking with a type guard before using it. The guard should require start and hours to be integers in the allowed range and reject invalid data with a clear error.

With one million bookings, where is the overlap check slow? What is V8 doing?
Checking a new booking with some() scans the bookings array, so one check takes O(n) time in the worst case. Generating a full report can be slower: it checks each booking against earlier bookings, which can take O(n²) time overall. V8 is running these JavaScript callbacks and comparisons synchronously on the main thread. Because the work is CPU-bound, it blocks the event loop until the scans finish. An index by room and date would reduce the number of bookings that need to be checked.

What happens if two terminals book the same room at the same time and save the file?
Each terminal has its own in-memory copy of the bookings. Both can read the file before either save completes, see the time as free, and accept the booking. They then write their copies to the same JSON file without a shared transaction or lock. One booking may overwrite the other, or the saved result may otherwise depend on the timing of the writes; both terminals might still report success. A database transaction or another cross-process locking mechanism is needed to prevent this race.

### How to submit

```bash
git checkout -b homework/<your-name>
# do the work, commit small and often
git push origin homework/<your-name>
```

Open a Pull Request titled `[Homework] <Full name>` and list the creative challenges you chose.
