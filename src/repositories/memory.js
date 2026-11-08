// One repository instance represents one in-memory application store.
export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookings = new Map();
  const reserved = new Map();
  return {
    async saveEvent(event) { events.set(event.id, event); return event; },
    async getEvent(id) { return events.get(id); },
    async listEvents() { return [...events.values()]; },
    async saveTier(tier) { tiers.set(tier.id, tier); return tier; },
    async getTier(id) { return tiers.get(id); },
    async reserveSeats(id, quantity) {
      const tier = tiers.get(id);
      if (!tier || tier.remaining < quantity) return 0;
      tier.remaining -= quantity;
      reserved.set(id, (reserved.get(id) ?? 0) + quantity);
      return 1;
    },
    async releaseSeats(id, quantity) {
      const tier = tiers.get(id);
      if (!tier || (reserved.get(id) ?? 0) < quantity) return 0;
      tier.remaining += quantity;
      reserved.set(id, reserved.get(id) - quantity);
      return 1;
    },
    async listTiers(eventId) { return [...tiers.values()].filter((tier) => tier.eventId === eventId); },
    async saveBooking(booking) { bookings.set(booking.reference, booking); return booking; },
    async getBooking(reference) { return bookings.get(reference); },
    async listBookings() { return [...bookings.values()]; },
  };
}
