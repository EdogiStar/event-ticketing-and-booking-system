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
  const { name } = input;
  const event = { id: newId(), name: requireText(name, 'event name'), tiers: new Map(), waitlist: new Queue() };
  store.events.set(event.id, event);
  return event;
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
  if (tier.remaining < quantity) {
    throw new DomainError('SOLD_OUT', `Only ${tier.remaining} ticket(s) remain in ${tier.name}`);
  }

  // Generate a unique reference before changing inventory, keeping failures atomic.
  let reference;
  do { reference = newReference(); } while (store.bookingsByReference.has(reference));
  const booking = {
    id: newId(), reference, eventId, tierId, attendeeName: name, quantity,
    totalPriceCents: tier.priceCents * quantity, status: 'confirmed',
  };
  tier.remaining -= quantity;
  store.bookingsByReference.set(reference, booking);
  store.bookings.push(booking);
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
  booking.status = 'cancelled';
  tier.remaining += booking.quantity;
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
  const { eventId, attendeeName, quantity = 1 } = input;
  const event = getEvent(store, eventId);
  const name = requireText(attendeeName, 'attendee name');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new DomainError('VALIDATION', 'quantity must be a whole number from 1 to 10');
  }
  const entry = { id: newId(), eventId, attendeeName: name, quantity };
  event.waitlist.enqueue(entry);
  return entry;
}
