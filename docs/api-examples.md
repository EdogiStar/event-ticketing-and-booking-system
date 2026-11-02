# API examples

Start the server with `npm start`. Each write request uses `x-user-id` until Build 7.

## Create an event

```sh
curl -X POST http://localhost:3000/api/events -H 'content-type: application/json' -H 'x-user-id: organizer-1' -d '{"title":"Lagos Tech Meetup","city":"Lagos","venue":"Civic Centre","date":"2026-12-05"}'
```

## Add a ticket tier

Use the event `id` returned above.

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/tiers -H 'content-type: application/json' -d '{"name":"General","priceCents":5000,"capacity":100}'
```

## Publish the event

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/publish
```

## Unpublish the event

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/unpublish
```

## Search published events

```sh
curl 'http://localhost:3000/api/events?q=tech&city=lagos&sort=price&maxPriceCents=5000'
```

## Book tickets

Use the `id` returned for the ticket tier.

```sh
curl -X POST http://localhost:3000/api/bookings -H 'content-type: application/json' -H 'x-user-id: attendee-1' -d '{"tierId":"TIER_ID","quantity":2}'
```

## Pay for a booking

The mock declines when `"decline": true` is sent; omit it for a successful charge. No card number is accepted.

```sh
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay -H 'content-type: application/json' -H 'x-user-id: attendee-1' -d '{}'
```

## Cancel an unpaid booking

```sh
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/cancel -H 'x-user-id: attendee-1'
```
