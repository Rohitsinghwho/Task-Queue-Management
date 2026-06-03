# Configuration

This project uses a small set of runtime configuration values.

## Environment Variables

### REDIS_URL
- Description: Redis connection string.
- Example: redis://localhost:6379
- Where used: [src/redisClient/client.ts](src/redisClient/client.ts)

## Runtime Options

### Queue
- maxAttempts (per job)
  - Default: 5
  - Where set: [src/classes/queue.ts](src/classes/queue.ts)

### WorkerOptions
Defined in [src/interfaces/workerOptions.ts](src/interfaces/workerOptions.ts).
- concurrency (default 1)
- visibilityTimeout seconds (default 60)
- pollTimeout seconds (default 5)

### JanitorOptions
Defined in [src/interfaces/janitorOptions.ts](src/interfaces/janitorOptions.ts).
- pollInterval ms (default 10000)
- visibilityTimeout seconds (default 60)
