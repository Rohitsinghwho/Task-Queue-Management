# Redis Reference (Project Usage)

This is a quick reference for the Redis commands used in this repo, including their arguments, return values, and how they are used here.

## Client Lifecycle

### createClient
- Where: src/redisClient/client.ts
- Purpose: Create a new Redis client instance.
- Args:
  - options: { url: string }
- Returns: Redis client instance (not connected yet).

### connect
- Where: src/redisClient/client.ts
- Purpose: Open a network connection to Redis.
- Args: none
- Returns: Promise<void>

### quit
- Where: src/classes/queue.ts, src/classes/worker.ts, src/classes/janitor.ts
- Purpose: Cleanly close the Redis connection.
- Args: none
- Returns: Promise<string> (server reply, typically "OK")

## List Commands

### lPush
- Where: src/classes/queue.ts, src/classes/worker.ts, src/classes/janitor.ts
- Purpose: Push an element to the left of a list.
- Args:
  - key: string
  - element: string
- Returns: Promise<number> (new list length)
- Usage in repo:
  - Enqueue job id into wait list.
  - Move jobs into completed/failed lists.
  - Retry flow pushes job id back to wait.

### lLen
- Where: src/classes/queue.ts
- Purpose: Get list length.
- Args:
  - key: string
- Returns: Promise<number>
- Usage in repo:
  - Queue stats (wait/active/completed/failed counts).

### lRange
- Where: src/classes/janitor.ts
- Purpose: Get a range of elements from a list.
- Args:
  - key: string
  - start: number
  - stop: number (use -1 for end)
- Returns: Promise<string[]>
- Usage in repo:
  - Scan all job ids from the active list.

### lRem
- Where: src/classes/worker.ts, src/classes/janitor.ts
- Purpose: Remove occurrences of a value from a list.
- Args:
  - key: string
  - count: number (0 removes all; >0 removes from head; <0 from tail)
  - element: string
- Returns: Promise<number> (number removed)
- Usage in repo:
  - Remove job ids from active list during completion/failure/recovery.

### lMove
- Where: src/classes/janitor.ts
- Purpose: Atomically move an element from one list to another.
- Args:
  - source: string
  - destination: string
  - from: "LEFT" | "RIGHT"
  - to: "LEFT" | "RIGHT"
- Returns: Promise<string | null> (moved element or null)
- Usage in repo:
  - Recover a stuck job by moving from active to wait.

### blMove
- Where: src/classes/worker.ts
- Purpose: Blocking version of LMOVE (waits for an element).
- Args:
  - source: string
  - destination: string
  - from: "LEFT" | "RIGHT"
  - to: "LEFT" | "RIGHT"
  - timeout: number (seconds)
- Returns: Promise<string | null>
- Usage in repo:
  - Worker polls for jobs, atomically moving from wait to active.

## Hash Commands

### hSet
- Where: src/classes/queue.ts, src/classes/worker.ts, src/classes/janitor.ts
- Purpose: Set one or more hash fields.
- Args:
  - key: string
  - field/value pairs or object map
- Returns: Promise<number> (number of fields newly added)
- Usage in repo:
  - Store job payload and update attempts/status/failedReason.

### hGetAll
- Where: src/classes/queue.ts, src/classes/worker.ts, src/classes/janitor.ts
- Purpose: Fetch all fields from a hash.
- Args:
  - key: string
- Returns: Promise<Record<string, string>>
- Usage in repo:
  - Load job payload by job id.

## String Commands

### set
- Where: src/classes/worker.ts
- Purpose: Set a string value with optional expiry.
- Args:
  - key: string
  - value: string
  - options: { EX: number } (seconds)
- Returns: Promise<string | null> ("OK" on success)
- Usage in repo:
  - Create a lock with TTL to mark job in-flight.

### get
- Where: src/classes/janitor.ts
- Purpose: Get a string value.
- Args:
  - key: string
- Returns: Promise<string | null>
- Usage in repo:
  - Check if a lock exists for an active job.

### del
- Where: src/classes/worker.ts
- Purpose: Delete a key.
- Args:
  - key: string
- Returns: Promise<number> (number of keys removed)
- Usage in repo:
  - Release a job lock when finished.

## Atomicity Notes

### What is atomic in Redis
- A single Redis command is atomic.
- Examples from this repo:
  - BLMOVE is atomic: it removes from the source list and adds to the destination as one operation.
  - LMOVE is atomic for the same reason.

### What is not atomic yet in this repo
- Any flow that requires multiple commands can be partially applied if a crash happens between steps.
- Examples:
  - Enqueue: HSET (store job) + LPUSH (add to wait list).
  - Worker completion/failure: LREM + LPUSH + HSET + DEL lock.
  - Janitor recovery: HSET + LMOVE.

### Example of atomicity vs non-atomicity
- Atomic example (safe):
  - BLMOVE wait active LEFT RIGHT
  - Either the job id moves or it does not; there is no partial state.
- Non-atomic example (risky in a crash):
  - HSET job hash
  - LPUSH wait list
  - If the process crashes after HSET but before LPUSH, the job exists but is not queued.

### How to make multi-step flows atomic
- Use Lua scripts (EVAL) to group multiple operations into one atomic server-side command.
- Alternative: Redis transactions (MULTI/EXEC), which are not rollback-safe but can still group commands.
