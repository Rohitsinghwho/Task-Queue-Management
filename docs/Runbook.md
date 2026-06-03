# Operational Runbook

## Start Order
1. Start Redis and ensure REDIS_URL is set.
2. Start the HTTP/SSE server (optional for observability).
3. Start one or more workers.
4. Start the janitor.
5. Run producer to enqueue jobs.

## Stop Order
1. Stop producer (if running).
2. Stop worker(s) via SIGINT (graceful shutdown waits for in-flight jobs).
3. Stop janitor via SIGINT.
4. Stop server if running.

## Health Checks
- /api/stats for counts.
- /api/stream for live events.

## Troubleshooting
- If wait list grows: add workers or increase concurrency.
- If active list grows: check worker logs for failures or slow handlers.
- If jobs stay in active without progress: janitor visibility timeout may be too long, or locks are not expiring.
