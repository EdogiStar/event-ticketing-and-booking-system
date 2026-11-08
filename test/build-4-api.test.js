import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/http/app.js';

async function withServer(run) {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await run(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}
const json = (value) => ({ 'content-type': 'application/json', ...value });

test('real API creates, publishes, searches, books, pays once, and cancels only unpaid bookings', async () => {
  await withServer(async (base) => {
    const create = await fetch(`${base}/api/events`, { method: 'POST', headers: json({ 'x-user-id': 'organizer' }), body: JSON.stringify({ title: 'Lagos Tech', city: 'Lagos', venue: 'Hall', date: '2026-12-05' }) });
    assert.equal(create.status, 201);
    const event = await create.json();
    const tierResponse = await fetch(`${base}/api/events/${event.id}/tiers`, { method: 'POST', headers: json({}), body: JSON.stringify({ name: 'General', priceCents: 1250, capacity: 3 }) });
    const tier = await tierResponse.json();
    assert.equal(tierResponse.status, 201);
    assert.equal(tier.remaining, 3);
    assert.equal((await fetch(`${base}/api/events`)).status, 200);
    await fetch(`${base}/api/events/${event.id}/publish`, { method: 'POST' });
    const search = await (await fetch(`${base}/api/events?q=TECH&city=lagos&sort=price`)).json();
    assert.equal(search.length, 1);
    const book = await fetch(`${base}/api/bookings`, { method: 'POST', headers: json({ 'x-user-id': 'attendee' }), body: JSON.stringify({ tierId: tier.id, quantity: 2 }) });
    const booking = await book.json();
    assert.equal(book.status, 201);
    assert.equal(booking.status, 'pending');
    assert.equal(booking.amountCents, 2500);
    const declined = await fetch(`${base}/api/bookings/${booking.reference}/pay`, { method: 'POST', headers: json({ 'x-user-id': 'attendee' }), body: JSON.stringify({ decline: true }) });
    assert.equal((await declined.json()).error.code, 'PAYMENT_DECLINED');
    const success = await fetch(`${base}/api/bookings/${booking.reference}/pay`, { method: 'POST', headers: json({ 'x-user-id': 'attendee' }), body: '{}' });
    assert.equal((await success.json()).status, 'paid');
    const secondPayment = await fetch(`${base}/api/bookings/${booking.reference}/pay`, { method: 'POST', headers: json({ 'x-user-id': 'attendee' }), body: '{}' });
    assert.equal((await secondPayment.json()).error.code, 'INVALID_TRANSITION');
    const cancelPaid = await fetch(`${base}/api/bookings/${booking.reference}/cancel`, { method: 'POST', headers: { 'x-user-id': 'attendee' } });
    assert.equal((await cancelPaid.json()).error.code, 'INVALID_TRANSITION');
  });
});

test('decline retains pending booking, ownership is enforced, and unpaid booking can be cancelled', async () => {
  await withServer(async (base) => {
    const event = await (await fetch(`${base}/api/events`, { method: 'POST', headers: json({ 'x-user-id': 'o' }), body: JSON.stringify({ title: 'Test', city: 'X', venue: 'Y', date: '2026-12-05' }) })).json();
    const tier = await (await fetch(`${base}/api/events/${event.id}/tiers`, { method: 'POST', headers: json({}), body: JSON.stringify({ name: 'A', priceCents: 5, capacity: 2 }) })).json();
    await fetch(`${base}/api/events/${event.id}/publish`, { method: 'POST' });
    const booking = await (await fetch(`${base}/api/bookings`, { method: 'POST', headers: json({ 'x-user-id': 'u1' }), body: JSON.stringify({ tierId: tier.id, quantity: 1 }) })).json();
    const wrongOwner = await fetch(`${base}/api/bookings/${booking.reference}/pay`, { method: 'POST', headers: json({ 'x-user-id': 'u2' }), body: '{}' });
    assert.equal(wrongOwner.status, 403);
    const decline = await fetch(`${base}/api/bookings/${booking.reference}/pay`, { method: 'POST', headers: json({ 'x-user-id': 'u1' }), body: '{"decline":true}' });
    assert.equal(decline.status, 400);
    const cancelled = await fetch(`${base}/api/bookings/${booking.reference}/cancel`, { method: 'POST', headers: { 'x-user-id': 'u1' } });
    assert.equal((await cancelled.json()).status, 'cancelled');
  });
});

test('API errors use the health error envelope', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/events/not-real/publish`, { method: 'POST' });
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.deepEqual(Object.keys(body), ['error']);
    assert.deepEqual(Object.keys(body.error), ['code', 'message']);
  });
});

test('S02-S04 API validates event and tier creation and supports unpublishing', async () => {
  await withServer(async (base) => {
    const headers = json({ 'x-user-id': 'organizer' });
    for (const input of [
      { city: 'Lagos', venue: 'Hall', date: '2026-12-05' },
      { title: 'Meetup', venue: 'Hall', date: '2026-12-05' },
      { title: 'Meetup', city: 'Lagos', venue: 'Hall', date: '2026-02-30' },
    ]) {
      const response = await fetch(`${base}/api/events`, { method: 'POST', headers, body: JSON.stringify(input) });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'VALIDATION');
    }
    const created = await fetch(`${base}/api/events`, { method: 'POST', headers, body: JSON.stringify({ title: 'Meetup', city: 'Lagos', venue: 'Hall', date: '2026-12-05' }) });
    const event = await created.json();
    assert.equal(event.published, false);
    const noTierPublish = await fetch(`${base}/api/events/${event.id}/publish`, { method: 'POST' });
    assert.equal((await noTierPublish.json()).error.code, 'INVALID_STATE');
    for (const fields of [{ name: 'General', priceCents: 1.5, capacity: 2 }, { name: 'General', priceCents: 1, capacity: 0 }]) {
      const response = await fetch(`${base}/api/events/${event.id}/tiers`, { method: 'POST', headers: json({}), body: JSON.stringify(fields) });
      assert.equal((await response.json()).error.code, 'VALIDATION');
    }
    const missingEvent = await fetch(`${base}/api/events/missing/tiers`, { method: 'POST', headers: json({}), body: JSON.stringify({ name: 'General', priceCents: 1, capacity: 2 }) });
    assert.equal((await missingEvent.json()).error.code, 'NOT_FOUND');
    await fetch(`${base}/api/events/${event.id}/tiers`, { method: 'POST', headers: json({}), body: JSON.stringify({ name: 'General', priceCents: 500, capacity: 2 }) });
    await fetch(`${base}/api/events/${event.id}/publish`, { method: 'POST' });
    assert.equal((await (await fetch(`${base}/api/events`)).json()).length, 1);
    const unpublished = await fetch(`${base}/api/events/${event.id}/unpublish`, { method: 'POST' });
    assert.equal((await unpublished.json()).published, false);
    assert.equal((await (await fetch(`${base}/api/events`)).json()).length, 0);
  });
});

test('S05 API filters, sorts, validates query options, and keeps drafts private', async () => {
  await withServer(async (base) => {
    async function addEvent(title, city, date, price) {
      const response = await fetch(`${base}/api/events`, { method: 'POST', headers: json({ 'x-user-id': 'o' }), body: JSON.stringify({ title, city, venue: `${title} venue`, date }) });
      const event = await response.json();
      const tier = await fetch(`${base}/api/events/${event.id}/tiers`, { method: 'POST', headers: json({}), body: JSON.stringify({ name: 'General', priceCents: price, capacity: 2 }) });
      await tier.json();
      return event;
    }
    const lagos = await addEvent('Lagos Tech Meetup', 'Lagos', '2026-12-05T17:00:00Z', 400);
    const lagosEarlierTitle = await addEvent('Lagos Art Meetup', 'Lagos', '2026-12-05T09:00:00Z', 350);
    const abuja = await addEvent('Abuja Jazz Night', 'Abuja', '2026-12-06', 200);
    await fetch(`${base}/api/events`, { method: 'POST', headers: json({ 'x-user-id': 'o' }), body: JSON.stringify({ title: 'Draft', city: 'Lagos', venue: 'Hall', date: '2026-12-01' }) });
    for (const id of [lagos.id, lagosEarlierTitle.id, abuja.id]) await fetch(`${base}/api/events/${id}/publish`, { method: 'POST' });
    const results = async (query) => (await fetch(`${base}/api/events?${query}`)).json();
    assert.deepEqual((await results('q=JAZZ')).map((event) => event.title), ['Abuja Jazz Night']);
    assert.deepEqual((await results('city=lagos&sort=date')).map((event) => event.title), ['Lagos Art Meetup', 'Lagos Tech Meetup']);
    assert.deepEqual((await results('maxPriceCents=300&sort=price')).map((event) => event.title), ['Abuja Jazz Night']);
    assert.deepEqual((await results('to=2026-12-05&sort=date')).map((event) => event.title), ['Lagos Art Meetup', 'Lagos Tech Meetup']);
    for (const query of ['from=2026-02-30', 'maxPriceCents=1.5', 'sort=unknown']) {
      const response = await fetch(`${base}/api/events?${query}`);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'VALIDATION');
    }
  });
});

test('S06 API rejects invalid quantities and sold-out requests without consuming inventory', async () => {
  await withServer(async (base) => {
    const event = await (await fetch(`${base}/api/events`, { method: 'POST', headers: json({ 'x-user-id': 'o' }), body: JSON.stringify({ title: 'Tickets', city: 'Lagos', venue: 'Hall', date: '2026-12-05' }) })).json();
    const tier = await (await fetch(`${base}/api/events/${event.id}/tiers`, { method: 'POST', headers: json({}), body: JSON.stringify({ name: 'General', priceCents: 100, capacity: 1 }) })).json();
    await fetch(`${base}/api/events/${event.id}/publish`, { method: 'POST' });
    for (const quantity of [0, -1, 1.5, 11]) {
      const response = await fetch(`${base}/api/bookings`, { method: 'POST', headers: json({ 'x-user-id': 'u' }), body: JSON.stringify({ tierId: tier.id, quantity }) });
      assert.equal((await response.json()).error.code, 'VALIDATION');
    }
    const soldOut = await fetch(`${base}/api/bookings`, { method: 'POST', headers: json({ 'x-user-id': 'u' }), body: JSON.stringify({ tierId: tier.id, quantity: 2 }) });
    assert.equal((await soldOut.json()).error.code, 'SOLD_OUT');
    const oneTicket = await fetch(`${base}/api/bookings`, { method: 'POST', headers: json({ 'x-user-id': 'u' }), body: JSON.stringify({ tierId: tier.id, quantity: 1 }) });
    assert.equal(oneTicket.status, 201);
  });
});

test('booking API enforces published events, cancellation ownership, and seat restoration', async () => {
  await withServer(async (base) => {
    const eventResponse = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: json({ 'x-user-id': 'organizer' }),
      body: JSON.stringify({ title: 'Seats', city: 'Lagos', venue: 'Hall', date: '2026-12-05' }),
    });
    const event = await eventResponse.json();
    const tierResponse = await fetch(`${base}/api/events/${event.id}/tiers`, {
      method: 'POST',
      headers: json({}),
      body: JSON.stringify({ name: 'General', priceCents: 100, capacity: 1 }),
    });
    const tier = await tierResponse.json();

    const draftBooking = await fetch(`${base}/api/bookings`, {
      method: 'POST',
      headers: json({ 'x-user-id': 'attendee' }),
      body: JSON.stringify({ tierId: tier.id, quantity: 1 }),
    });
    assert.equal(draftBooking.status, 400);
    assert.equal((await draftBooking.json()).error.code, 'INVALID_STATE');

    await fetch(`${base}/api/events/${event.id}/publish`, { method: 'POST' });
    const bookingResponse = await fetch(`${base}/api/bookings`, {
      method: 'POST',
      headers: json({ 'x-user-id': 'attendee' }),
      body: JSON.stringify({ tierId: tier.id, quantity: 1 }),
    });
    const booking = await bookingResponse.json();
    assert.equal(bookingResponse.status, 201);

    const wrongOwner = await fetch(`${base}/api/bookings/${booking.reference}/cancel`, {
      method: 'POST',
      headers: { 'x-user-id': 'someone-else' },
    });
    assert.equal(wrongOwner.status, 403);
    assert.equal((await wrongOwner.json()).error.code, 'FORBIDDEN');

    const cancelled = await fetch(`${base}/api/bookings/${booking.reference}/cancel`, {
      method: 'POST',
      headers: { 'x-user-id': 'attendee' },
    });
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).status, 'cancelled');

    const payCancelled = await fetch(`${base}/api/bookings/${booking.reference}/pay`, {
      method: 'POST',
      headers: json({ 'x-user-id': 'attendee' }),
      body: '{}',
    });
    assert.equal(payCancelled.status, 400);
    assert.equal((await payCancelled.json()).error.code, 'INVALID_TRANSITION');

    const replacement = await fetch(`${base}/api/bookings`, {
      method: 'POST',
      headers: json({ 'x-user-id': 'another-attendee' }),
      body: JSON.stringify({ tierId: tier.id, quantity: 1 }),
    });
    assert.equal(replacement.status, 201);

    for (const action of ['pay', 'cancel']) {
      const missing = await fetch(`${base}/api/bookings/missing/${action}`, {
        method: 'POST',
        headers: json({ 'x-user-id': 'attendee' }),
        body: '{}',
      });
      assert.equal(missing.status, 404);
      assert.equal((await missing.json()).error.code, 'NOT_FOUND');
    }
  });
});
