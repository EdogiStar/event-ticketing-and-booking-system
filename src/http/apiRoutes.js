import { createMemoryRepository } from '../repositories/memory.js';
import { createEventService } from '../services/eventService.js';
import { createBookingService } from '../services/bookingService.js';
import { createMockPaymentGateway } from '../lib/mockPaymentGateway.js';

export function registerApiRoutes(router, { repository = createMemoryRepository(), paymentGateway = createMockPaymentGateway() } = {}) {
  const events = createEventService(repository);
  const bookings = createBookingService(repository, paymentGateway);
  router.post('/api/events', async ({ request, body, response }) => {
    const result = await events.create(body, request.headers['x-user-id']);
    response.statusCode = 201;
    return result;
  });
  router.post('/api/events/:id/tiers', async ({ params, body, response }) => {
    const result = await events.addTier(params.id, body);
    response.statusCode = 201;
    return result;
  });
  router.post('/api/events/:id/publish', ({ params }) => events.publish(params.id));
  router.post('/api/events/:id/unpublish', ({ params }) => events.unpublish(params.id));
  router.get('/api/events', ({ query }) => {
    const criteria = {};
    for (const key of ['q', 'city', 'from', 'to']) if (query.has(key)) criteria[key] = query.get(key);
    if (query.has('maxPriceCents')) criteria.maxPriceCents = Number(query.get('maxPriceCents'));
    if (query.has('onlyAvailable')) criteria.onlyAvailable = query.get('onlyAvailable') === 'true';
    return events.search(criteria, query.get('sort') ?? query.get('sortBy') ?? 'date');
  });
  router.post('/api/bookings', async ({ request, body, response }) => {
    const result = await bookings.book(body, request.headers['x-user-id']);
    response.statusCode = 201;
    return result;
  });
  router.post('/api/bookings/:reference/pay', ({ request, params, body }) => bookings.pay(params.reference, request.headers['x-user-id'], body));
  router.post('/api/bookings/:reference/cancel', ({ request, params }) => bookings.cancel(params.reference, request.headers['x-user-id']));
  return { repository, events, bookings };
}
