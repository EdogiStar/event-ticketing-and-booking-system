export function createSqliteRepository(database) {
  const eventFromRow = (row) => row && ({ id: row.id, organizerId: row.organizer_id, title: row.title, name: row.title, city: row.city, venue: row.venue, date: row.date, published: Boolean(row.published) });
  const tierFromRow = (row) => row && ({ id: row.id, eventId: row.event_id, name: row.name, priceCents: row.price_cents, capacity: row.capacity, remaining: row.capacity - row.sold });
  const bookingFromRow = (row) => row && ({ id: row.id, reference: row.reference, eventId: row.event_id, tierId: row.tier_id, userId: row.user_id, quantity: row.quantity, amountCents: row.amount_cents, totalPriceCents: row.total_price_cents, status: row.status });
  const events = database.prepare('SELECT * FROM events WHERE id = ?');
  const allEvents = database.prepare('SELECT * FROM events');
  const tiers = database.prepare('SELECT * FROM ticket_tiers WHERE id = ?');
  const eventTiers = database.prepare('SELECT * FROM ticket_tiers WHERE event_id = ?');
  const bookings = database.prepare('SELECT * FROM bookings WHERE reference = ?');
  return {
    async saveEvent(event) {
      database.prepare(`INSERT INTO events (id, organizer_id, title, city, venue, date, published) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET organizer_id=excluded.organizer_id, title=excluded.title, city=excluded.city, venue=excluded.venue, date=excluded.date, published=excluded.published`)
        .run(event.id, event.organizerId, event.title ?? event.name, event.city, event.venue, event.date, Number(event.published));
      return event;
    },
    async getEvent(id) { return eventFromRow(events.get(id)); },
    async listEvents() { return allEvents.all().map(eventFromRow); },
    async saveTier(tier) {
      const sold = tier.capacity - tier.remaining;
      database.prepare(`INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, sold) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, price_cents=excluded.price_cents, capacity=excluded.capacity, sold=excluded.sold`)
        .run(tier.id, tier.eventId, tier.name, tier.priceCents, tier.capacity, sold);
      return tier;
    },
    async getTier(id) { return tierFromRow(tiers.get(id)); },
    async listTiers(eventId) { return eventTiers.all(eventId).map(tierFromRow); },
    async reserveSeats(id, quantity) {
      return database.prepare('UPDATE ticket_tiers SET sold = sold + ? WHERE id = ? AND sold + ? <= capacity').run(quantity, id, quantity).changes;
    },
    async releaseSeats(id, quantity) {
      return database.prepare('UPDATE ticket_tiers SET sold = sold - ? WHERE id = ? AND sold >= ?').run(quantity, id, quantity).changes;
    },
    async saveBooking(booking) {
      database.prepare(`INSERT INTO bookings (id, reference, event_id, tier_id, user_id, quantity, amount_cents, total_price_cents, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(reference) DO UPDATE SET status=excluded.status, quantity=excluded.quantity, amount_cents=excluded.amount_cents, total_price_cents=excluded.total_price_cents`)
        .run(booking.id, booking.reference, booking.eventId, booking.tierId, booking.userId, booking.quantity, booking.amountCents, booking.totalPriceCents, booking.status);
      return booking;
    },
    async getBooking(reference) { return bookingFromRow(bookings.get(reference)); },
    async listBookings() { return database.prepare('SELECT * FROM bookings').all().map(bookingFromRow); },
  };
}
