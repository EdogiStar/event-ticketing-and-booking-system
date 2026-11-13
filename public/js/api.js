import { mockBookings, mockEvents } from './mockData.js';

const copy = (value) => structuredClone(value);
export async function listEvents(criteria = {}) {
  let result = mockEvents.filter((event) => event.published);
  const query = String(criteria.q ?? '').trim().toLowerCase();
  if (query) result = result.filter((event) => [event.title, event.city, event.venue].some((value) => value.toLowerCase().includes(query)));
  if (criteria.city) result = result.filter((event) => event.city.toLowerCase() === String(criteria.city).toLowerCase());
  if (Number.isFinite(criteria.maxPriceCents)) result = result.filter((event) => event.tiers.some((tier) => tier.priceCents <= criteria.maxPriceCents));
  result.sort((a, b) => criteria.sort === 'price' ? Math.min(...a.tiers.map((tier) => tier.priceCents)) - Math.min(...b.tiers.map((tier) => tier.priceCents)) : criteria.sort === 'title' ? a.title.localeCompare(b.title) : new Date(a.date) - new Date(b.date));
  return copy(result);
}
export async function getEvent(id) { const event = mockEvents.find((item) => item.id === id); if (!event) throw new Error('Event not found'); return copy(event); }
export async function createBooking({ tierId, quantity }) {
  const event = mockEvents.find((item) => item.tiers.some((tier) => tier.id === tierId));
  const tier = event?.tiers.find((item) => item.id === tierId);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) { const error = new Error('Quantity must be a whole number from 1 to 10'); error.code = 'VALIDATION'; throw error; }
  if (!tier || tier.remaining < quantity) { const error = new Error('SOLD_OUT'); error.code = 'SOLD_OUT'; throw error; }
  tier.remaining -= quantity;
  const booking = { reference: `MOCK-${String(mockBookings.length + 1).padStart(4, '0')}`, eventId: event.id, tierId, quantity, amountCents: tier.priceCents * quantity, totalPriceCents: tier.priceCents * quantity, status: 'pending', expiresAt: Date.now() + 10 * 60 * 1000 };
  mockBookings.push(booking);
  return copy(booking);
}
export async function pay(reference, { decline = false } = {}) { const booking = mockBookings.find((item) => item.reference === reference); if (!booking) throw new Error('Booking not found'); if (decline) { const error = new Error('Payment was declined'); error.code = 'PAYMENT_DECLINED'; throw error; } booking.status = 'paid'; return copy(booking); }
