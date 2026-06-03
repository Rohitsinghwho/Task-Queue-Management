# Refactor Notes

## The Goal of this refactor
Make the TypeScript source compatible with Node ESM output by using explicit `.js` import extensions and matching real filename casing.

## What changed
- Local imports now include the `.js` extension.
- Import paths were aligned with actual file casing in `src/classes`.

## Files Updated
- src/classes/janitor.ts
- src/classes/queue.ts
- src/classes/worker.ts
- src/producer.ts
- src/worker_start.ts
- src/janitor_start.ts
- src/interfaces/jobOptions.ts

## What is in these files

### src/classes/janitor.ts
Defines the `Janitor` class. It scans the active queue, checks for expired locks, and moves stuck jobs back to the wait queue or to failed once max attempts are exceeded. Uses Redis helpers and key builders.

### src/classes/queue.ts
Defines the `Queue` class used by producers. Supports creating a queue client, adding jobs, fetching jobs by id, and getting queue status/length. Handles job serialization and deserialization for Redis hashes.

### src/classes/worker.ts
Defines the `Worker` class. It runs concurrent polling loops, moves jobs into the active list, sets visibility locks, executes task handlers, and handles completion, failure, and retry with backoff.

### src/producer.ts
A simple producer entry that creates a queue and enqueues example jobs (send email, resize image, generate report), then prints queue length and closes the connection.

### src/worker_start.ts
Worker entrypoint. Creates a worker with concurrency and wires a SIGINT handler for graceful shutdown, then starts the worker.

### src/janitor_start.ts
Janitor entrypoint. Creates the janitor with a poll interval, wires SIGINT for shutdown, and starts the cleanup loop.

### src/interfaces/jobOptions.ts
Defines `Job` and `JobOptions` interfaces and imports `jobStatus` for typing the job state.

## Rationale
Node ESM requires explicit file extensions at runtime. Using `.js` in import paths keeps emitted JavaScript valid while preserving TypeScript source semantics.
