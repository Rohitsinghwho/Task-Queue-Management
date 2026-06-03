# Roadmap

This is a forward-looking list of improvements for stability and scale.

## Atomicity and Consistency
- Lua scripts for enqueue, complete, fail, recover.
- Optional MULTI/EXEC for grouped operations.

## Reliability
- Redis-backed delayed queue (sorted set) for retries.
- Idempotency keys to prevent duplicate side effects.
- DLQ processing and replay tools.

## Scalability
- Multiple queues with priority or weighted fairness.
- Per-task concurrency limits and rate limiting.
- Worker sharding strategies.

## Observability
- Structured logging (job id, attempt, latency).
- Metrics (processed/failed/retried per minute).
- Dashboard for queue state and worker health.
