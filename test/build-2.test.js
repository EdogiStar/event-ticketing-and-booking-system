import test from 'node:test';
import assert from 'node:assert/strict';
import { addTier, bookTickets, createEvent, createStore, listEventSummaries, publishEvent } from '../src/domain/inventory.js';
import { DomainError } from '../src/domain/errors.js';
import { filterEvents, searchEvents, sortEvents } from '../src/domain/eventSearch.js';
import { mergeSort } from '../src/domain/sorting.js';

function code(expected, fn) { assert.throws(fn, (error) => error instanceof DomainError && error.code === expected); }
const makeStoreEvent = (input = { title: 'Lagos Tech Meetup', city: 'Lagos', venue: 'Civic Hall', date: '2026-12-05T17:00:00Z' }) => {
  const store = createStore(); const event = createEvent(store, input); return { store, event };
};
function summary(id, title, date, price, city = 'Lagos', remaining = 2, venue = 'Hall') {
  return { id, title, city, venue, date, tiers: price === null ? [] : [{ priceCents: price, remaining }] };
}

test('S02 creates a draft with generated id and keeps it off public list', () => {
  const { store, event } = makeStoreEvent();
  assert.ok(event.id); assert.equal(event.title, 'Lagos Tech Meetup'); assert.equal(event.published, false);
  assert.deepEqual(listEventSummaries(store), []);
});
test('S02 rejects missing title/city and invalid calendar date without saving', () => {
  const store = createStore();
  for (const input of [{ title: 'X', venue: 'Hall', date: '2026-01-01' }, { city: 'Lagos', venue: 'Hall', date: '2026-01-01' }, { title: 'X', city: 'Lagos', venue: 'Hall', date: '2026-02-30' }]) code('VALIDATION', () => createEvent(store, input));
  assert.equal(store.events.size, 0);
});
test('S03 saves tier with zero sold and full capacity remaining', () => {
  const { store, event } = makeStoreEvent(); const tier = addTier(store, event.id, { name: 'General', priceCents: 500000, capacity: 100 });
  assert.equal(tier.remaining, 100); assert.equal(tier.capacity - tier.remaining, 0);
});
test('S03 rejects fractional or noninteger price and capacity below one', () => {
  const { store, event } = makeStoreEvent();
  for (const fields of [{ priceCents: 1.5, capacity: 2 }, { priceCents: 1, capacity: 0 }]) code('VALIDATION', () => addTier(store, event.id, { name: 'T', ...fields }));
});
test('S03 reports NOT_FOUND for unknown event when adding a tier', () => {
  code('NOT_FOUND', () => addTier(createStore(), 'missing', { name: 'T', priceCents: 1, capacity: 1 }));
});
test('S04 cannot publish without tiers (INVALID_STATE)', () => {
  const { store, event } = makeStoreEvent(); code('INVALID_STATE', () => publishEvent(store, event.id));
});
test('S04 publishing makes an event visible in public summaries', () => {
  const { store, event } = makeStoreEvent(); addTier(store, event.id, { name: 'General', priceCents: 10, capacity: 1 });
  publishEvent(store, event.id); assert.equal(listEventSummaries(store).length, 1);
});
test('S04 un-published drafts remain hidden while admin can list all summaries', () => {
  const { store } = makeStoreEvent(); assert.deepEqual(listEventSummaries(store), []); assert.equal(listEventSummaries(store, { publishedOnly: false }).length, 1);
});
test('S04 publishing an unknown event reports NOT_FOUND', () => { code('NOT_FOUND', () => publishEvent(createStore(), 'missing')); });

test('S05 query matches title or venue case-insensitively', () => {
  const events = [summary('a', 'Lagos Tech Meetup', '2026-01-01', 10), summary('b', 'Abuja Jazz Night', '2026-01-01', 10, 'Abuja', 2, 'Jazz Club')];
  assert.deepEqual(filterEvents(events, { q: 'JAZZ' }).map((e) => e.id), ['b']);
});
test('S05 city is exact and case-insensitive', () => {
  const events = [summary('a', 'A', '2026-01-01', 1, 'Lagos'), summary('b', 'B', '2026-01-01', 1, 'Lagos Island')];
  assert.deepEqual(filterEvents(events, { city: 'lagos' }).map((e) => e.id), ['a']);
});
test('S05 maximum price uses cheapest tier and excludes events without tiers', () => {
  const events = [summary('a', 'A', '2026-01-01', 500), { ...summary('b', 'B', '2026-01-01', 700), tiers: [{ priceCents: 100 }, { priceCents: 600 }] }, summary('c', 'C', '2026-01-01', null)];
  assert.deepEqual(searchEvents(events, { maxPriceCents: 200 }, 'price').map((e) => e.id), ['b']);
});
test('S05 same-day date sort breaks ties by title', () => {
  const events = [summary('b', 'Beta', '2026-05-02T09:00:00Z', 1), summary('a', 'Alpha', '2026-05-02T18:00:00Z', 1)];
  assert.deepEqual(sortEvents(events, 'date').map((e) => e.title), ['Alpha', 'Beta']);
});
test('S05 date-only upper bound includes events later that day', () => {
  const events = [summary('a', 'Late', '2026-12-05T17:00:00Z', 1)]; assert.equal(filterEvents(events, { to: '2026-12-05' }).length, 1);
});
test('S05 rejects malformed dates, fractional price and unknown sort with VALIDATION', () => {
  code('VALIDATION', () => filterEvents([], { from: '2026-02-30' }));
  code('VALIDATION', () => filterEvents([], { maxPriceCents: 1.1 }));
  code('VALIDATION', () => sortEvents([], 'random'));
});
test('S05 filtering and sorting leave input lists unchanged; empty inputs work', () => {
  const events = [summary('b', 'B', '2026-01-01', 2), summary('a', 'A', '2026-01-01', 1)]; const snapshot = structuredClone(events);
  const sorted = sortEvents(events, 'price'); const filtered = filterEvents(events, { city: 'lagos' });
  assert.deepEqual(events, snapshot); assert.notEqual(sorted, events); assert.notEqual(filtered, events);
  assert.deepEqual(filterEvents([], {}), []); assert.deepEqual(sortEvents([], 'date'), []);
});
test('mergeSort is stable and returns a new array', () => {
  const items = [{ key: 1, n: 'first' }, { key: 0, n: 'zero' }, { key: 1, n: 'second' }];
  const sorted = mergeSort(items, (a, b) => a.key - b.key); assert.deepEqual(sorted.map((x) => x.n), ['zero', 'first', 'second']); assert.notEqual(sorted, items); assert.deepEqual(items.map((x) => x.n), ['first', 'zero', 'second']);
});

test('S06 booking reserves requested seats and calculates whole cents', () => {
  const { store, event } = makeStoreEvent(); const tier = addTier(store, event.id, { name: 'General', priceCents: 125, capacity: 3 });
  const booking = bookTickets(store, { eventId: event.id, tierId: tier.id, attendeeName: 'Ada', quantity: 2 });
  assert.equal(booking.quantity, 2); assert.equal(booking.totalPriceCents, 250); assert.equal(tier.remaining, 1);
});
test('S06 sold out rejection changes nothing', () => {
  const { store, event } = makeStoreEvent(); const tier = addTier(store, event.id, { name: 'General', priceCents: 10, capacity: 1 }); const before = { remaining: tier.remaining, bookings: store.bookings.length };
  code('SOLD_OUT', () => bookTickets(store, { eventId: event.id, tierId: tier.id, attendeeName: 'Ada', quantity: 2 }));
  assert.deepEqual({ remaining: tier.remaining, bookings: store.bookings.length }, before);
});
test('S06 rejects quantities outside integer range 1 to 10 with VALIDATION', () => {
  const { store, event } = makeStoreEvent(); const tier = addTier(store, event.id, { name: 'General', priceCents: 10, capacity: 20 });
  for (const quantity of [0, -1, 1.5, 11]) code('VALIDATION', () => bookTickets(store, { eventId: event.id, tierId: tier.id, attendeeName: 'Ada', quantity }));
});
