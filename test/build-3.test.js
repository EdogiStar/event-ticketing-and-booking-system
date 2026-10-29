import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/http/app.js';
import { createRouter } from '../src/http/router.js';
import { BOOKING_STATES, assertTransition, canTransition } from '../src/domain/bookingStateMachine.js';
import { DomainError } from '../src/domain/errors.js';

const allowed = [['pending', 'paid'], ['pending', 'cancelled'], ['paid', 'checked_in'], ['paid', 'refunded'], ['paid', 'cancelled']];
const states = Object.values(BOOKING_STATES);

test('booking state machine accepts every allowed move', () => {
  for (const [from, to] of allowed) {
    assert.equal(canTransition(from, to), true);
    assert.doesNotThrow(() => assertTransition(from, to));
  }
});

test('booking state machine rejects every illegal move', () => {
  for (const from of states) for (const to of states) {
    if (allowed.some(([allowedFrom, allowedTo]) => allowedFrom === from && allowedTo === to)) continue;
    assert.equal(canTransition(from, to), false, `${from} to ${to}`);
    assert.throws(() => assertTransition(from, to), (error) => error instanceof DomainError && error.code === 'INVALID_TRANSITION');
  }
  assert.throws(() => assertTransition('unknown', 'paid'), (error) => error.code === 'INVALID_TRANSITION');
});

test('router matches method, path and decoded params', () => {
  const router = createRouter();
  const handler = () => 'matched';
  router.get('/api/events/:eventId', handler);
  assert.equal(router.match('GET', '/api/events/a%20b').handler, handler);
  assert.deepEqual(router.match('GET', '/api/events/a%20b').params, { eventId: 'a b' });
  assert.equal(router.match('POST', '/api/events/123'), null);
  assert.equal(router.match('GET', '/api/events'), null);
});

test('real HTTP GET /health responds with JSON status', async (t) => {
  const server = createApp();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('HTTP errors use consistent JSON and malformed JSON is 400', async (t) => {
  const router = createRouter();
  router.post('/api/echo', ({ body }) => body);
  const server = createApp({ router });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const badJson = await fetch(`${base}/api/echo`, { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } });
  assert.equal(badJson.status, 400);
  assert.deepEqual(Object.keys((await badJson.json()).error).sort(), ['code', 'message']);
  const missing = await fetch(`${base}/api/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(Object.keys((await missing.json()).error).sort(), ['code', 'message']);
});
