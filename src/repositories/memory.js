// One repository instance represents one in-memory application store.
export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookings = new Map();
  return {
    async saveEvent(event) { events.set(event.id, event); return event; },
    async getEvent(id) { return events.get(id); },
    async listEvents() { return [...events.values()]; },
    async saveTier(tier) { tiers.set(tier.id, tier); return tier; },
    async getTier(id) { return tiers.get(id); },
    async listTiers(eventId) { return [...tiers.values()].filter((tier) => tier.eventId === eventId); },
    async saveBooking(booking) { bookings.set(booking.reference, booking); return booking; },
    async getBooking(reference) { return bookings.get(reference); },
    async listBookings() { return [...bookings.values()]; },
  };
}