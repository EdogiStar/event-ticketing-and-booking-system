const events = [
  { id: 'event-lagos-tech', title: 'Lagos Tech Meetup', city: 'Lagos', venue: 'Civic Centre', date: '2026-12-05T10:00:00.000Z', published: true, tiers: [{ id: 'tier-lagos-general', eventId: 'event-lagos-tech', name: 'General', priceCents: 500000, capacity: 100, remaining: 42 }, { id: 'tier-lagos-vip', eventId: 'event-lagos-tech', name: 'VIP', priceCents: 1250000, capacity: 25, remaining: 4 }] },
  { id: 'event-abuja-jazz', title: 'Abuja Jazz Evening', city: 'Abuja', venue: 'The Dome', date: '2026-12-12T18:30:00.000Z', published: true, tiers: [{ id: 'tier-abuja-standard', eventId: 'event-abuja-jazz', name: 'Standard', priceCents: 250000, capacity: 80, remaining: 18 }, { id: 'tier-abuja-premium', eventId: 'event-abuja-jazz', name: 'Premium', priceCents: 750000, capacity: 20, remaining: 0 }] },
  { id: 'event-ibadan-food', title: 'Ibadan Food Festival', city: 'Ibadan', venue: 'Agodi Gardens', date: '2027-01-09T11:00:00.000Z', published: true, tiers: [{ id: 'tier-ibadan-entry', eventId: 'event-ibadan-food', name: 'Entry', priceCents: 150000, capacity: 200, remaining: 73 }] },
];
export const mockEvents = structuredClone(events);
export const mockBookings = [];
