# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

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
