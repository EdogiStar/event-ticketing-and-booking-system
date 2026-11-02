import { DomainError } from '../domain/errors.js';
import { newId } from '../domain/ids.js';
import { searchEvents } from '../domain/eventSearch.js';

function need(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new DomainError('VALIDATION', `${label} must be a non-empty string`);
  return value.trim();
}
function eventOrThrow(event, id) { if (!event) throw new DomainError('NOT_FOUND', `Event ${String(id)} was not found`); return event; }

export function createEventService(repository) {
  return {
    async create(input, userId) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DomainError('VALIDATION', 'event must be an object');
      const title = need(input.title, 'event title');
      const city = need(input.city, 'event city');
      const venue = need(input.venue, 'event venue');
      const date = input.date ?? input.startsAt;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(date) || Number.isNaN(Date.parse(date)) || (date.length === 10 && new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date)) throw new DomainError('VALIDATION', 'event date must be a valid ISO date');
      if (!userId) throw new DomainError('VALIDATION', 'x-user-id header is required');
      return repository.saveEvent({ id: newId(), organizerId: userId, title, name: title, city, venue, date, published: false });
    },
    async addTier(eventId, input) {
      eventOrThrow(await repository.getEvent(eventId), eventId);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DomainError('VALIDATION', 'tier must be an object');
      const name = need(input.name, 'tier name');
      if (!Number.isSafeInteger(input.priceCents) || input.priceCents < 0) throw new DomainError('VALIDATION', 'priceCents must be a non-negative whole number of cents');
      if (!Number.isSafeInteger(input.capacity) || input.capacity < 1) throw new DomainError('VALIDATION', 'capacity must be a positive whole number');
      const tier = { id: newId(), eventId, name, priceCents: input.priceCents, capacity: input.capacity, remaining: input.capacity };
      await repository.saveTier(tier);
      return tier;
    },
    async publish(eventId) {
      const event = eventOrThrow(await repository.getEvent(eventId), eventId);
      if ((await repository.listTiers(eventId)).length === 0) throw new DomainError('INVALID_STATE', 'An event needs at least one ticket tier before publishing');
      event.published = true;
      return repository.saveEvent(event);
    },
    async unpublish(eventId) {
      const event = eventOrThrow(await repository.getEvent(eventId), eventId);
      event.published = false;
      return repository.saveEvent(event);
    },
    async search(criteria, sortBy = 'date') {
      const all = await repository.listEvents();
      const summaries = [];
      for (const event of all) if (event.published) summaries.push({ ...event, tiers: await repository.listTiers(event.id) });
      return searchEvents(summaries, criteria, sortBy);
    },
  };
}
