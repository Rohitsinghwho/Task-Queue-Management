# Testing Strategy

## Current State
- No automated tests in the repo.

## Suggested Tests
- Unit tests:
  - Backoff calculation.
  - Job serialization/deserialization.
  - Key naming helpers.
- Integration tests (with Redis):
  - Enqueue -> claim -> complete flow.
  - Failure -> retry flow.
  - Janitor recovery when lock expires.
- Load tests:
  - Measure throughput at different concurrency levels.

## Local Test Setup
- Run Redis locally.
- Use a dedicated test queue name to avoid conflicts.
