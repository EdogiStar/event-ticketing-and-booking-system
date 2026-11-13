# AI log

## Build 1

### Prompt 1: Domain core in the terminal
- **What I asked:** Create the Build 1 terminal domain core, linked FIFO waitlist, demo, and lookup benchmark with no external packages.
- **What came back:** Added the domain errors, crypto IDs/references, inventory operations, linked queue, runnable demo, benchmark, and npm scripts.
- **What was wrong (or "nothing"):** Booking input was initially destructured before validation, so null input could escape as a TypeError; changed the operations to validate their input objects first. Used unbiased `crypto.randomInt` for reference characters.

## Build 2

### Prompt 1: Build 2 prompt (`docs/build-2.md`)
- **What I asked:** Implement Build 2 event publishing, search, filtering, and sorting according to the project requirements.
- **What came back:** Added publishing rules, event search and filters, stable merge sort, and automated tests.
- **What was wrong (or "nothing"):** S04 acceptance criteria were blank, so assumptions were made about publishing rules and tested accordingly.

### Prompt 2: Testing and verification
- **What I asked:** Run the tests and demo to verify Build 2 and preserve Build 1 functionality.
- **What came back:** All 20 tests passed, and the existing demo ran successfully.
- **What was wrong (or "nothing"):** Nothing failed during verification; S04 assumptions still need confirmation.

## Build 3

### Prompt 1: Build 3 prompt (docs/build-3.md)
- **What I asked:** Add the architecture diagrams, booking state machine, Node HTTP router/server, configuration, startup script, and tests.
- **What came back:** A layered architecture document, explicit booking transitions, static-file HTTP server, `/health` route, startup configuration, and `node:test` coverage.
- **What was wrong (or "nothing"):** The first server draft relied on an implicit response/request property for HEAD handling and had redundant error-status logic; both were simplified. Added a regression test proving static requests cannot escape `public/`.

## Build 4

### Prompt 1: Build 4 prompt (`docs/build-4.md`)
- **What I asked:** Add the in-memory repository, injected services, mock payment gateway, REST routes, curl examples, and real-server API tests.
- **What came back:** The API supports event and tier creation, publishing and search, pending bookings, mock payment, and unpaid cancellation.
- **What was wrong (or "nothing"):** The first response-status implementation committed headers before the shared JSON responder ran; changed route handlers to set `statusCode` and let the responder write headers. The existing state machine permits a paid-to-cancelled transition for later builds, so the service explicitly limits cancellation to pending bookings in Build 4.
- **Assumption:** The mock decline is requested with `{ "decline": true }`; the gateway receives only that boolean and never receives card data.

## Build 5

### Prompt 2: SQLite persistence and overselling fix
- **What I asked:** Implement the Build 5 requirements in `docs/build-5.md`: SQLite persistence, atomic seat reservation, a 50-request overselling test, and a before/after demo.
- **What came back:** Added a SQLite schema and repository, wired the server to persistent SQLite storage, made the booking service reserve seats through one conditional database update, and added the regression test and demo.
- **What was wrong (or "nothing"):** The project had no SQLite implementation even though Build 5's prompt assumed one existed. Added the missing persistence layer while preserving the in-memory repository used by existing tests.
- **Why not a lock variable or a second check:** A JavaScript lock variable only coordinates callers sharing that particular process and can be bypassed by another process or worker, so it cannot protect the shared database. Checking availability twice still has a race because multiple requests can pass the check before either writes; the conditional update combines the check and reservation into one database operation.
- **Demo:** The old read-then-write flow accepted 50 bookings for 1 available seat (49 excess); the conditional SQLite update accepted 1 booking, returned `SOLD_OUT` for 49, and stored 1 sold seat.

### Prompt 2: API verification
- **What I asked:** Run the complete `node:test` suite, including requests against a real server on a free port.
- **What came back:** All 28 tests passed.
- **What was wrong (or "nothing"):** Nothing remained failing after fixing the response status handling and enforcing Build 4's unpaid-only cancellation rule.

### Prompt 3: Complete Build 4 criteria
- **What I asked:** Compare the project with the Build 4 criteria and complete any missing API behavior and acceptance tests.
- **What came back:** Added an unpublish service operation and API route, documented its curl call, and expanded real-server API coverage for S02-S06 validation and behavior.
- **What was wrong (or "nothing"):** The initial Build 4 implementation omitted unpublishing and relied too heavily on domain tests for criteria that Build 4 requires to pass through the API. Added the missing route and API-level cases.

## Build 6

### Prompt 1: Frontend on mock data
- **What I asked:** Build the plain HTML, CSS and browser ES-module frontend with event browsing, filters, ticket selection, checkout countdown and mock payment.
- **What came back:** Added the two pages, reusable DOM helper, mock API/data, responsive styles, and accessible checkout flow.
- **What was wrong (or "nothing"):** Nothing remained failing; the mock data values were assumed because no dataset was specified.
