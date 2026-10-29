import { DomainError } from './errors.js';
import { newId, newReference } from './ids.js';
import { Queue } from './waitlistQueue.js';

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object`);
  }
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${label} must be a non-empty string`);
  }
  return value.trim();
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError('VALIDATION', `${label} must be a positive whole number`);
  }
  return value;
}

function requireStore(store) {
  requireObject(store, 'store');
  if (!(store.events instanceof Map) || !(store.bookingsByReference instanceof Map)) {
    throw new DomainError('VALIDATION', 'store was not created by createStore');
  }
}

function getEvent(store, eventId) {
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('NOT_FOUND', `Event ${String(eventId)} was not found`);
  return event;
}

function getTier(event, tierId) {
  const tier = event.tiers.get(tierId);
  if (!tier) throw new DomainError('NOT_FOUND', `Ticket tier ${String(tierId)} was not found`);
  return tier;
}

export function createStore() {
  return { events: new Map(), bookingsByReference: new Map(), bookings: [] };
}

export function createEvent(store, input) {
  requireStore(store);
  requireObject(input, 'event');
  const { name, title, city, venue, date } = input;
  if (title !== undefined || city !== undefined || venue !== undefined || date !== undefined) {
    requireText(title, 'event title'); requireText(city, 'event city'); requireText(venue, 'event venue');
    if (!isValidIsoDate(date)) throw new DomainError('VALIDATION', 'event date must be a valid ISO date');
  }
  const eventName = requireText(title ?? name, 'event title');
  const event = { id: newId(), name: eventName, title: eventName, tiers: new Map(), waitlist: new Queue(), published: false };
  if (city !== undefined) event.city = requireText(city, 'event city');
  if (venue !== undefined) event.venue = requireText(venue, 'event venue');
  if (date !== undefined) {
    if (!isValidIsoDate(date)) throw new DomainError('VALIDATION', 'event date must be a valid ISO date');
    event.date = date;
  }
  store.events.set(event.id, event);
  return event;
}

function isValidIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && !Number.isNaN(Date.parse(value)) &&
    (value.length !== 10 || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value);
}

export function publishEvent(store, eventId) {
  requireStore(store);
  const event = getEvent(store, eventId);
  if (event.tiers.size === 0) throw new DomainError('INVALID_STATE', 'An event needs at least one ticket tier before publishing');
  event.published = true;
  return event;
}

export function listEventSummaries(store, { publishedOnly = true } = {}) {
  requireStore(store);
  if (typeof publishedOnly !== 'boolean') throw new DomainError('VALIDATION', 'publishedOnly must be a boolean');
  return [...store.events.values()]
    .filter((event) => !publishedOnly || event.published)
    .map((event) => ({
      id: event.id, name: event.name, title: event.title ?? event.name, city: event.city, venue: event.venue,
      date: event.date, published: Boolean(event.published),
      tiers: [...event.tiers.values()].map((tier) => ({ ...tier })),
    }));
}

export function addTier(store, eventId, input) {
  requireStore(store);
  requireObject(input, 'tier');
  const { name, priceCents, capacity } = input;
  const event = getEvent(store, eventId);
  const tierName = requireText(name, 'tier name');
  if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
    throw new DomainError('VALIDATION', 'priceCents must be a non-negative whole number of cents');
  }
  requirePositiveInteger(capacity, 'capacity');
  const tier = { id: newId(), eventId, name: tierName, priceCents, capacity, remaining: capacity };
  event.tiers.set(tier.id, tier);
  return tier;
}

export function bookTickets(store, input) {
  requireStore(store);
  requireObject(input, 'booking');
  const { eventId, tierId, attendeeName, quantity } = input;
  const name = requireText(attendeeName, 'attendee name');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new DomainError('VALIDATION', 'quantity must be a whole number from 1 to 10');
  }
  const event = getEvent(store, eventId);
  const tier = getTier(event, tierId);
  const booking = createBooking(store, event, tier, name, quantity, tier.remaining);
  tier.remaining -= quantity;
  store.bookingsByReference.set(booking.reference, booking);
  store.bookings.push(booking);
  return booking;
}

function createBooking(store, event, tier, name, quantity, available) {
  if (available < quantity) {
    throw new DomainError('SOLD_OUT', `Only ${available} ticket(s) remain in ${tier.name}`);
  }

  // Generate a unique reference before changing inventory, keeping failures atomic.
  let reference;
  do { reference = newReference(); } while (store.bookingsByReference.has(reference));
  const booking = {
    id: newId(), reference, eventId: event.id, tierId: tier.id, attendeeName: name, quantity,
    totalPriceCents: tier.priceCents * quantity, status: 'confirmed',
  };
  return booking;
}

export function cancelBooking(store, reference) {
  requireStore(store);
  const code = requireText(reference, 'booking reference');
  const booking = store.bookingsByReference.get(code);
  if (!booking) throw new DomainError('NOT_FOUND', `Booking ${code} was not found`);
  if (booking.status === 'cancelled') throw new DomainError('ALREADY_CANCELLED', `Booking ${code} is already cancelled`);
  const event = getEvent(store, booking.eventId);
  const tier = getTier(event, booking.tierId);
  const next = event.waitlist.peek();
  let fulfilledBooking;
  if (next && next.tierId === tier.id) {
    const name = requireText(next.attendeeName, 'attendee name');
    if (!Number.isSafeInteger(next.quantity) || next.quantity < 1 || next.quantity > 10) {
      throw new DomainError('VALIDATION', 'quantity must be a whole number from 1 to 10');
    }
    if (next.quantity <= tier.remaining + booking.quantity) {
      // Prepare against capacity cancellation will release; validation and ID/reference
      // generation finish before cancellation or inventory state changes.
      fulfilledBooking = createBooking(
        store, event, tier, name, next.quantity, tier.remaining + booking.quantity,
      );
    }
  }
  booking.status = 'cancelled';
  tier.remaining += booking.quantity;
  if (fulfilledBooking) {
    tier.remaining -= fulfilledBooking.quantity;
    store.bookingsByReference.set(fulfilledBooking.reference, fulfilledBooking);
    store.bookings.push(fulfilledBooking);
    event.waitlist.dequeue();
    // Additive return detail; existing callers still receive the cancelled booking.
    booking.fulfilledBooking = fulfilledBooking;
  }
  return booking;
}

export function findBookingByReference(store, reference) {
  requireStore(store);
  const code = requireText(reference, 'booking reference');
  const booking = store.bookingsByReference.get(code);
  if (!booking) throw new DomainError('NOT_FOUND', `Booking ${code} was not found`);
  return booking;
}

export function joinWaitlist(store, input) {
  requireStore(store);
  requireObject(input, 'waitlist entry');
  const { eventId, tierId, attendeeName, quantity = 1 } = input;
  const event = getEvent(store, eventId);
  const tier = getTier(event, tierId);
  const name = requireText(attendeeName, 'attendee name');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new DomainError('VALIDATION', 'quantity must be a whole number from 1 to 10');
  }
  const entry = { id: newId(), eventId, tierId: tier.id, attendeeName: name, quantity };
  event.waitlist.enqueue(entry);
  return entry;
}
