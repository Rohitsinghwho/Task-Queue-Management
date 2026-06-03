# Performance and Tuning Notes

## Current Behavior
- Workers use BLMOVE with a poll timeout to wait for jobs efficiently.
- Concurrency is controlled by spawning N run loops.
- Task handlers can be CPU-bound (see demo tasks), which reduces throughput.

## Tuning Knobs
- Worker concurrency: increase for higher throughput if handlers are I/O-bound.
- Visibility timeout: increase if handlers take longer than expected.
- Poll timeout: lower values check for shutdown more frequently; higher values reduce wakeups.

## Known Bottlenecks
- Busy-wait handlers in [src/task.ts](src/task.ts) block the event loop.
- Retry scheduling is in-process; many retries can add timer overhead.

## Suggested Improvements
- Use async I/O in handlers instead of busy waits.
- Move delayed retries to Redis sorted set + time-based mover.
- Add per-task concurrency limits to avoid starvation.
