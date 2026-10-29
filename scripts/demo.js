import { addTier, bookTickets, cancelBooking, createEvent, createStore, findBookingByReference, joinWaitlist } from '../src/domain/inventory.js';
import { DomainError } from '../src/domain/errors.js';

const store = createStore();
const event = createEvent(store, { name: 'Summer Sounds' });
const tier = addTier(store, event.id, { name: 'General Admission', priceCents: 2500, capacity: 3 });

console.log(`${event.name}: ${tier.capacity} ${tier.name} tickets available.`);
const ada = bookTickets(store, { eventId: event.id, tierId: tier.id, attendeeName: 'Ada', quantity: 2 });
console.log(`Ada booked 2 tickets. Reference: ${ada.reference}. ${tier.remaining} seat(s) remain.`);
try {
  bookTickets(store, { eventId: event.id, tierId: tier.id, attendeeName: 'Bayo', quantity: 2 });
} catch (error) {
  if (!(error instanceof DomainError)) throw error;
  console.log(`Bayo's booking was refused (${error.code}): ${error.message}.`);
}
bookTickets(store, { eventId: event.id, tierId: tier.id, attendeeName: 'Chidi', quantity: 1 });
console.log(`The event is sold out: ${tier.remaining} seat(s) remain.`);
const first = joinWaitlist(store, { eventId: event.id, attendeeName: 'Dara' });
const second = joinWaitlist(store, { eventId: event.id, attendeeName: 'Emeka' });
console.log(`${first.attendeeName} and ${second.attendeeName} joined the waitlist in that order.`);
console.log(`Lookup by reference found ${findBookingByReference(store, ada.reference).attendeeName}.`);
cancelBooking(store, ada.reference);
console.log(`Ada cancelled; ${tier.remaining} seat(s) were released.`);
console.log(`Next in line: ${event.waitlist.peek().attendeeName}.`);
