vg# Data Model

This doc describes Redis keys and payload shape used by the queue.

## Key Naming
Keys are built in [src/utils/keys.ts](src/utils/keys.ts).

### Lists
- queue:<queueName>:wait
- queue:<queueName>:active
- queue:<queueName>:completed
- queue:<queueName>:failed
- queue:<queueName>:dlq (reserved)

### Hashes
- bq:<queueName>:job:<jobId>
  - Stores job payload and metadata fields.

### Locks
- bq:<queueName>:lock:<jobId>
  - String value, TTL set to visibility timeout.

## Job Hash Fields
Fields stored in the job hash (see [src/classes/queue.ts](src/classes/queue.ts)):
- id: string
- type: string
- args: JSON string
- attempts: string (int)
- maxAttempts: string (int)
- status: pending | active | completed | failed | retrying
- createdAt: string (Date.toString())
- lockedUntil: string (timestamp) or empty
- failedReason: string or empty

## Data Flow Summary
- Enqueue: job hash written + job id pushed to wait list.
- Claim: worker uses BLMOVE wait -> active.
- Complete/Fail: job id removed from active and pushed to completed/failed.
- Recover: janitor moves from active -> wait if lock expired.
