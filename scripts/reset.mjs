// Put bookings.json back to the 5 original bookings (before a demo, or after trying things out).
import { copyFile } from "node:fs/promises";

await copyFile("data/bookings.seed.json", "bookings.json");
await copyFile("data/coupons.seed.json", "coupons.json");
console.log("bookings.json, coupons.json has been reset to the original data.");
