import { DomainError } from '../domain/errors.js';
import { assertTransition } from '../domain/bookingStateMachine.js';
import { newId, newReference } from '../domain/ids.js';

function required(value, label) { if (typeof value !== 'string' || !value.trim()) throw new DomainError('VALIDATION', `${label} is required`); return value.trim(); }
function get(record, label, id) { if (!record) throw new DomainError('NOT_FOUND', `${label} ${String(id)} was not found`); return record; }

export function createBookingService(repository, paymentGateway) {
  return {
    async book(input, userId) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DomainError('VALIDATION', 'booking must be an object');
      required(userId, 'x-user-id header');
      if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) throw new DomainError('VALIDATION', 'quantity must be a whole number from 1 to 10');
      const tier = get(await repository.getTier(input.tierId), 'Ticket tier', input.tierId);
      const event = get(await repository.getEvent(tier.eventId), 'Event', tier.eventId);
      if (!event.published) throw new DomainError('INVALID_STATE', 'Tickets can only be booked for a published event');
      let reference;
      do { reference = newReference(); } while (await repository.getBooking(reference));
      const booking = { id: newId(), reference, eventId: event.id, tierId: tier.id, userId, quantity: input.quantity, amountCents: tier.priceCents * input.quantity, totalPriceCents: tier.priceCents * input.quantity, status: 'pending' };
      const changed = await repository.reserveSeats(tier.id, input.quantity);
      if (changed !== 1) throw new DomainError('SOLD_OUT', `Not enough tickets remain in ${tier.name}`);
      return repository.saveBooking(booking);
    },
    async pay(reference, userId, payment = {}) {
      const booking = get(await repository.getBooking(reference), 'Booking', reference);
      if (booking.userId !== userId) throw new DomainError('FORBIDDEN', 'Only the attendee who made this booking can pay for it');
      assertTransition(booking.status, 'paid');
      const result = await paymentGateway.charge({ decline: payment.decline === true });
      if (!result.success) throw new DomainError('PAYMENT_DECLINED', 'Payment was declined');
      booking.status = 'paid';
      return repository.saveBooking(booking);
    },
    async cancel(reference, userId) {
      const booking = get(await repository.getBooking(reference), 'Booking', reference);
      if (booking.userId !== userId) throw new DomainError('FORBIDDEN', 'Only the attendee who made this booking can cancel it');
      if (booking.status !== 'pending') throw new DomainError('INVALID_TRANSITION', `Booking cannot transition from ${booking.status} to cancelled in this build`);
      assertTransition(booking.status, 'cancelled');
      booking.status = 'cancelled';
      const tier = get(await repository.getTier(booking.tierId), 'Ticket tier', booking.tierId);
      await repository.releaseSeats(tier.id, booking.quantity);
      return repository.saveBooking(booking);
    },
  };
}
