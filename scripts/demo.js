import { addTier, bookTickets, cancelBooking, createEvent, createStore, findBookingByReference, joinWaitlist } from '../src/domain/inventory.js';
import { DomainError } from '../src/domain/errors.js';

const store = createStore();
const event = createEvent(store, { name: 'Summer Sounds' });
const tier = addTier(store, event.id, { name: 'General Admission', priceCents: 2500, capacity: 4 });

console.log(`${event.name}: ${tier.capacity} ${tier.name} tickets available.`);
const ada = bookTickets(store, { eventId: event.id, tierId: tier.id, attendeeName: 'Ada', quantity: 2 });
console.log(`Ada booked 2 tickets. Reference: ${ada.reference}. ${tier.remaining} seat(s) remain.`);
try {
  bookTickets(store, { eventId: event.id, tierId: tier.id, attendeeName: 'Bayo', quantity: 3 });
} catch (error) {
  if (!(error instanceof DomainError)) throw error;
  console.log(`Bayo's booking was refused (${error.code}): ${error.message}.`);
}
const chidi = bookTickets(store, { eventId: event.id, tierId: tier.id, attendeeName: 'Chidi', quantity: 2 });
console.log(`The event is sold out: ${tier.remaining} seat(s) remain.`);
const first = joinWaitlist(store, { eventId: event.id, tierId: tier.id, attendeeName: 'Dara', quantity: 2 });
const second = joinWaitlist(store, { eventId: event.id, tierId: tier.id, attendeeName: 'Emeka', quantity: 1 });
console.log(`${first.attendeeName} and ${second.attendeeName} joined the waitlist in that order.`);
console.log(`Lookup by reference found ${findBookingByReference(store, ada.reference).attendeeName}.`);
const cancellation = cancelBooking(store, chidi.reference);
console.log(`Chidi cancelled; the released seats were assigned to the first eligible waitlisted attendee.`);
const next = cancellation.fulfilledBooking;
console.log(`Next in line: ${first.attendeeName} received ${next.quantity} tickets. ${tier.remaining} seat(s) remain.`);
