import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createMemoryRepository } from '../src/repositories/memory.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';

const attempts = 50;

// Reproduce the old read-then-write flow to show why it oversells.
const oldRepository = createMemoryRepository();
await oldRepository.saveEvent({ id: 'before-event', organizerId: 'organizer', title: 'Before Fix', city: 'Lagos', venue: 'Hall', date: '2026-12-05', published: true });
await oldRepository.saveTier({ id: 'before-tier', eventId: 'before-event', name: 'Last seat', priceCents: 1000, capacity: attempts, remaining: 1 });
let oldSuccesses = 0;
await Promise.all(Array.from({ length: attempts }, async (_, index) => {
  const tier = await oldRepository.getTier('before-tier');
  await Promise.resolve();
  tier.remaining -= 1;
  await oldRepository.saveTier(tier);
  oldSuccesses += 1;
  await oldRepository.saveBooking({ reference: `BEFORE${index}`, id: `before-${index}`, eventId: 'before-event', tierId: 'before-tier', userId: `user-${index}`, quantity: 1, amountCents: 1000, totalPriceCents: 1000, status: 'pending' });
}));
console.log(`Before atomic database reservation: ${oldSuccesses} successful bookings, 0 SOLD_OUT, ${oldSuccesses - 1} bookings beyond the 1 seat available.`);

const directory = mkdtempSync(path.join(tmpdir(), 'oversell-demo-'));
const database = createDatabase(path.join(directory, 'demo.sqlite'));
try {
  const repository = createSqliteRepository(database);
  const eventService = createEventService(repository);
  const event = await eventService.create({ title: 'After Fix', city: 'Lagos', venue: 'Hall', date: '2026-12-05' }, 'organizer');
  const tier = await eventService.addTier(event.id, { name: 'General', priceCents: 1000, capacity: 1 });
  await eventService.publish(event.id);
  const bookingService = createBookingService(repository, createMockPaymentGateway());
  const results = await Promise.all(Array.from({ length: attempts }, (_, index) =>
    bookingService.book({ tierId: tier.id, quantity: 1 }, `user-${index}`).then(() => true, (error) => {
      if (error.code !== 'SOLD_OUT') throw error;
      return false;
    })));
  const successes = results.filter(Boolean).length;
  console.log(`After atomic database reservation: ${successes} successful booking(s), ${attempts - successes} SOLD_OUT, ${(await repository.getTier(tier.id)).capacity - (await repository.getTier(tier.id)).remaining} ticket(s) sold.`);
} finally {
  database.close();
  rmSync(directory, { recursive: true, force: true });
}
