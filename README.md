# Distributed Task Queue Management

A production-grade distributed task queue built to learn how systems like Celery, BullMQ, and SQS work under the hood. This project evolves across phases to add persistence, reliability, and resiliency.

## Architecture

```mermaid
graph TD
  P[Producer] --> Q[Redis Queue (jobs)]
  Q --> W[Worker]
  W -->|ACK| DONE[Completed]
  W -->|NACK/Retry| Q
  W -->|In-flight| PQ[Processing Queue (jobs:processing)]
  J[Janitor] -->|Requeue if lock expired| Q
  W -->|Lock TTL| L[lock:<jobId>]
```

## Phases (Short Summary)

- **Phase 1: In-Memory Queue**
  - FIFO queue in memory with polling vs blocking.
  - Task registry + serialization/deserialization.
- **Phase 2: Redis-Backed Queue**
  - Persistent Redis List with `LPUSH` + `BRPOP`.
  - Producer/Worker split for decoupled scaling.
- **Phase 3: Reliable Queue + Visibility Timeout**
  - Atomic `BLMOVE` from `jobs` to `jobs:processing`.
  - Manual ACK (`LREM`) and per-job locks with TTL.
  - Janitor re-queues only when locks expire.
  - Retry with exponential backoff and jitter.

Detailed docs:
- docs/Phase_one.md
- docs/Phase_two.md
- docs/Phase_three.md
- docs/Project_Overview.md

## Setup Guide

### Prerequisites
- Node.js 18+ (or any modern Node.js LTS)
- Redis (local or hosted)

### Install

```bash
npm install
```

### Configure Environment

Create a `.env` file in the project root:

```
REDIS_URL=redis://localhost:6379
```

If you use a hosted Redis provider, set the connection string accordingly.

### Run

Open separate terminals:

```bash
npm run worker
```

```bash
npm run janitor
```

```bash
npm run producer
```

## Notes

- `worker` processes jobs from the main queue and tracks in-flight items in `jobs:processing`.
- `janitor` re-queues jobs only when their lock has expired.
- Failed jobs retry with exponential backoff until `maxAttempts` is reached.
