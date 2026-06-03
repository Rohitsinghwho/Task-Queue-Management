# Concurrency, Reliability, and Durability (Current + Future)

This document summarizes how the current queue behaves with Redis and where it can be improved.

## Concurrency (Current)
- Worker supports configurable concurrency via N parallel poll loops.
- Each loop uses BLMOVE to atomically claim a job from wait -> active.
- Active jobs are tracked in memory so the worker can drain in-flight work on shutdown.
- Jobs are processed independently; no ordering guarantees beyond list ordering for each claim.

### Concurrency Risks (Current)
- No global rate limiting or per-task concurrency limits.
- No work stealing or partitioning for multi-queue setups.
- Task handlers are user code; long or blocking handlers can reduce throughput.

## Reliability (Current)
- Visibility timeout via lock key with TTL.
- Janitor scans active list and recovers jobs with expired locks.
- Retry policy uses exponential backoff with jitter.
- Max attempts cap moves jobs to failed list.

### Reliability Risks (Current)
- Several transitions are not atomic (multi-step Redis operations).
- Worker crash between steps can leave partial state (e.g., job in active with no status update).
- Retry scheduling uses setTimeout in-process; crashes can drop scheduled retries.
- No DLQ workflow beyond a list key; no inspection or replay tooling.

## Durability (Current)
- Redis persists job payloads in hashes and job ids in lists.
- Durability depends on Redis configuration (RDB/AOF and snapshot frequency).
- The code assumes Redis is the source of truth; no secondary storage.

### Durability Risks (Current)
- If Redis is configured without persistence, jobs can be lost on restart.
- Partial writes can occur if a process crashes between multi-command transitions.
- No explicit handling for Redis failover or connection loss.

## Future Enhancements

### Concurrency
- Per-queue and per-task concurrency limits.
- Rate limiting (token bucket or leaky bucket) at the worker level.
- Multiple queues with priority or weighted fairness.
- Worker sharding and partitioned queues for horizontal scale.

### Reliability
- Lua scripts for atomic transitions:
  - Enqueue (HSET + LPUSH).
  - Complete/fail (LREM + LPUSH + HSET + DEL lock).
  - Recover (HSET + LMOVE).
- Retry scheduling as a Redis-based delayed queue (sorted set + time-based mover).
- Explicit DLQ processing and replay tools.
- Idempotency keys for job handlers to avoid duplicate side effects.
- Health checks and heartbeats for worker liveness.

### Durability
- Document and enforce Redis persistence settings (AOF recommended).
- Use Redis replication and automatic failover (Redis Sentinel or managed service).
- Store job payloads with versioning to support schema changes.
- Optional external storage for job payloads (e.g., database or object store) with Redis as index.

## Notes
- Concurrency is currently optimistic and throughput-oriented.
- Reliability and durability are acceptable for demo use but should be hardened for production.
