import { performance } from 'node:perf_hooks';

const BOOKINGS = 100_000;
const LOOKUPS = 500;
const bookings = Array.from({ length: BOOKINGS }, (_, index) => ({ reference: `REF-${index}`, id: index }));
const byReference = new Map(bookings.map((booking) => [booking.reference, booking]));
const targets = Array.from({ length: LOOKUPS }, (_, index) => `REF-${(index * 199) % BOOKINGS}`);
let matches = 0;

const arrayStart = performance.now();
for (const reference of targets) if (bookings.find((booking) => booking.reference === reference)) matches += 1;
const arrayMs = performance.now() - arrayStart;
const mapStart = performance.now();
for (const reference of targets) if (byReference.get(reference)) matches += 1;
const mapMs = performance.now() - mapStart;

console.log(`Lookups: ${LOOKUPS} among ${BOOKINGS.toLocaleString()} bookings`);
console.log(`Array.find: ${arrayMs.toFixed(3)} ms (O(n) per lookup)`);
console.log(`Map.get:    ${mapMs.toFixed(3)} ms (O(1) average per lookup)`);
console.log(`Map was ${(arrayMs / Math.max(mapMs, 0.001)).toFixed(1)}x faster; matches checked: ${matches}.`);
