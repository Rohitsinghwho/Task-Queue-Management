# Project Status after Phase 3 and Refactoring

## Overview
This project implements a Redis-backed distributed task queue with producers, workers, and a janitor process. Jobs are stored as Redis hashes and moved across Redis lists to track state. An HTTP server exposes queue stats and a live event stream via SSE.

## What Exists Today
- Queue client for enqueueing jobs and inspecting counts.
- Worker runtime that polls for jobs, executes handlers, and handles retries.
- Janitor that scans for stuck jobs and recovers them.
- Redis client factories for queue/worker/janitor connections.
- Task registry with example handlers.
- SSE server for real-time queue events and stats.

## Core Flow
- Producer enqueues a job:
  - Job payload is stored in a Redis hash.
  - Job id is pushed to the wait list.
- Worker consumes jobs:
  - BLMOVE atomically transfers a job id from wait to active.
  - A lock key is set with TTL to mark the job in-flight.
  - The handler runs; on success the job is moved to completed.
  - On failure the job is retried with exponential backoff, or moved to failed if attempts exceed limits.
- Janitor recovery:
  - Scans the active list for jobs without a lock.
  - Recovers stuck jobs back to wait or moves to failed if max attempts exceeded.

## Current Features
- Concurrency: worker can process N jobs in parallel.
- Retry policy: exponential backoff with jitter.
- Visibility timeout: lock TTL to detect stuck jobs.
- Events: queue lifecycle events emitted through a typed event bus.
- Observability: HTTP stats endpoint and SSE live stream.

## Non-Atomic Operations
These operations are not yet wrapped in Lua and can be partially applied if a crash happens between steps:
- Enqueue: hash write + list push.
- Worker completion and failure transitions.
- Janitor recovery logic.

## Known Gaps / TODO
- Lua scripts for atomic transitions (enqueue, complete, fail, recover).
- Dead-letter queue usage (key exists but not wired).
- Persistent metrics beyond list sizes.
- Test coverage for worker/janitor edge cases.

## How To Run (Manual)
- Start Redis and set REDIS_URL.
- Run producer to enqueue jobs.
- Start worker to process jobs.
- Start janitor to recover stuck jobs.
- Start server for stats and SSE.

## Files Of Interest
- src/classes/queue.ts
- src/classes/worker.ts
- src/classes/janitor.ts
- src/redisClient/client.ts
- src/server.ts
- src/task.ts
