# Security Notes

## Current State
- Redis connection is configured via REDIS_URL.
- No explicit TLS/auth enforcement in code; it depends on the URL.

## Recommendations
- Use a Redis URL with AUTH and TLS (rediss://).
- Store secrets in environment variables, not committed files.
- Restrict Redis network access to trusted hosts.
- Consider rotating credentials for production deployments.
