# Failure Modes and Recovery

This doc lists known failure scenarios and what the system does today.

## Non-Atomic Transitions
- Enqueue: HSET + LPUSH can be partially applied.
- Complete/Fail: LREM + LPUSH + HSET + DEL can be partially applied.
- Recover: HSET + LMOVE can be partially applied.

## Worker Crash Scenarios
- After BLMOVE but before lock:
  - Job id is in active, no lock exists.
  - Janitor will recover it after visibility timeout.
- During handler execution:
  - Lock exists until TTL expires.
  - Janitor will recover if lock expires and job is still active.
- After completion LREM but before LPUSH completed:
  - Job hash exists but job id may be missing from completed list.

## Producer Crash Scenarios
- After HSET but before LPUSH wait:
  - Job exists but is not queued; it will not be processed.

## Retry Timing Loss
- Retries are scheduled via setTimeout in the worker process.
- If the worker dies before the timeout fires, the job may not be requeued.

## Redis Outage
- All queue state lives in Redis; outage prevents enqueueing and processing.
- Recovery depends on Redis persistence configuration.
