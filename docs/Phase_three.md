# Phase 3 Enhancements (Reliable Queue + Visibility Timeout)

## The Goal of Phase 3
Move away from destructive popping (`BRPOP`) that can lose jobs on crashes, and implement a resilient, two-list architecture (Reliable Queue Pattern) where tasks are tracked until they are successfully completed.

---

## What We Built in Phase 3

We introduced a secondary tracking layer known as a **Processing Queue** (`jobs:processing`) alongside the Main Queue (`jobs`).

Instead of removing an item from the database instantly upon pickup, the worker shifts the item into this temporary "In-Flight" buffer. If the worker crashes mid-execution, the item stays safe inside the database.

### 1. Atomic Work Handover via `blMove`
We replaced the destructive `brPop` command with `blMove`. This command pops an item from the source list and pushes it to the destination list atomically in a single, unbreakable operation.

```javascript
const rawJob = await workerClient.blMove(
  QUEUE_NAME,
  PROCESSING_QUEUE_NAME,
  'RIGHT',
  'LEFT',
  1 // Timeout in seconds
);
```

### 2. Manual Acknowledgment (`lRem`)
We updated `processJobs` to accept the Redis client instance. The worker now processes the task first. Only after the task function runs successfully does it explicitly instruct Redis to clear the job from the processing list.

```javascript
try {
  await taskFunction(job.args);
  console.log(`Job ${job.id} completed successfully`);

  // Explicitly remove the job only after a successful run
  await workerClient.lRem(PROCESSING_QUEUE_NAME, 1, rawJob);
} catch (err) {
  console.log(`Error processing job ${job.id}:`, err);
}
```

### 3. The Janitor (Recovery) Script
Because interrupted or crashed tasks get stuck inside the processing list indefinitely, we implemented a decoupled background script (`janitor.js`). It routinely scans the processing list using an atomic `lMove` operation to safely recover orphan tasks and cycle them back into the main workflow.

```javascript
const recoveredJob = await janitorClient.lMove(
  PROCESSING_QUEUE_NAME,
  QUEUE_NAME,
  "RIGHT",
  "LEFT"
);
```

---

## Key Concepts Introduced

### Processing Queue (In-Flight Storage)
A temporary storage buffer representing tasks currently actively running inside a worker. It solves the core dilemma of Phase 2: protecting the task data if the application process dies mid-execution.

### High Availability vs. Application Resiliency
* **Store Durability (RDB/AOF / Upstash Storage):** Protects your queue if the *database machine* dies or loses power.
* **App Durability (`blMove`):** Protects your queue if your *worker process* crashes due to software bugs or system exceptions.

---

## The Issues Encountered

### 1. The Closed Socket Conflict (`ClientClosedError`)
When embedding the Janitor's checking routine inside a standard JavaScript `setInterval` loop while using a `finally { await client.quit() }` block, the first execution closed the socket. Subsequent loop iterations attempted to reuse the dead connection, triggering application crashes.
* **The Fix:** Modified the system architecture to establish a single persistent connection on startup that remains alive across all interval runs.

### 2. The Over-Aggressive Recovery Race Condition
Because a basic Janitor uses `lMove` to indiscriminately sweep the processing queue, it cannot differentiate between a dead worker and a slow, healthy worker. If a job takes 10 seconds to compute and the Janitor triggers at second 5, it will mistakenly flag the job as stranded, steal it, and push it back to the main list—causing the job to execute multiple times simultaneously.

---

## The Solution: Visibility Timeout (Leasing) + Locks

To resolve the race condition and reach production-grade stability, we added a **Visibility Timeout (Leasing) Strategy** with per-job locks.

### What Was Added
1. **Lease Locking on Pickup:** When a worker grabs a job via `blMove`, it immediately sets a lock key with a short TTL: `lock:<jobId>`.
2. **Janitor-Aware Recovery:** The janitor now checks the lock before re-queueing. If the lock exists, the job is still in progress and is skipped. If the lock is missing or expired, the job is re-queued.
3. **Lock Cleanup on Completion/Failure:** On success or failure, the worker removes the lock and either acknowledges the job or retries it.
4. **Retry with Exponential Backoff:** Failed jobs are re-queued with exponential backoff and jitter until `maxAttempts` is reached.

### Example Output After Adding Visibility Timeout and Locks

```
Janitor started — checking every 10 seconds
Janitor connected to Redis. Cleaning up processing queue: jobs:processing
Job c16bd09a-c625-413c-ab42-c08cae1f79f2 is currently locked. Skipping.
Job 171df8cf-bdb6-429e-b609-2b81d0e854a3 lock expired — requeueing
Janitor connected to Redis. Cleaning up processing queue: jobs:processing
Job c16bd09a-c625-413c-ab42-c08cae1f79f2 is currently locked. Skipping.
Janitor connected to Redis. Cleaning up processing queue: jobs:processing
Job c16bd09a-c625-413c-ab42-c08cae1f79f2 is currently locked. Skipping.
Janitor connected to Redis. Cleaning up processing queue: jobs:processing
Job c16bd09a-c625-413c-ab42-c08cae1f79f2 is currently locked. Skipping.
Janitor connected to Redis. Cleaning up processing queue: jobs:processing
Job c16bd09a-c625-413c-ab42-c08cae1f79f2 lock expired — requeueing
Janitor connected to Redis. Cleaning up processing queue: jobs:processing
Processing queue jobs:processing is already empty. No cleanup needed.
```

## Implementation Notes (Current Behavior)
1. **Lock Key Format:** `lock:<jobId>` with a TTL equal to `VISIBILITY_TIMEOUT` (seconds).
2. **Janitor Interval:** Runs every 10 seconds; scans `jobs:processing` and re-queues only when the lock is missing.
3. **Failure Path:** `NACK` removes the job from processing, clears the lock, increments attempts, and retries with exponential backoff until `maxAttempts` is reached.