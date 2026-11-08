import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';

test('50 simultaneous bookings for the final seat produce one success and 49 SOLD_OUT errors', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'oversell-'));
  const database = createDatabase(path.join(directory, 'test.sqlite'));
  try {
    const repository = createSqliteRepository(database);
    const events = createEventService(repository);
    const event = await events.create({ title: 'Last Seat', city: 'Lagos', venue: 'Hall', date: '2026-12-05' }, 'organizer');
    const tier = await events.addTier(event.id, { name: 'General', priceCents: 1000, capacity: 1 });
    await events.publish(event.id);
    const bookings = createBookingService(repository, createMockPaymentGateway());

    const results = await Promise.all(Array.from({ length: 50 }, (_, index) =>
      bookings.book({ tierId: tier.id, quantity: 1 }, `attendee-${index}`).then(
        (booking) => ({ success: true, booking }),
        (error) => ({ success: false, code: error.code }),
      )));

    assert.equal(results.filter((result) => result.success).length, 1);
    assert.equal(results.filter((result) => result.code === 'SOLD_OUT').length, 49);
    assert.equal((await repository.getTier(tier.id)).remaining, 0);
    assert.equal((await repository.listBookings()).length, 1);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
