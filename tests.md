# Test Suite Documentation

TaskFlow uses **Jest** and **Supertest** for automated testing, with **MongoDB-Memory-Server** for isolated database testing. Tests run in `NODE_ENV=test` mode.

## Running Tests

```bash
npm test
```

This runs all test suites with coverage reporting via `--coverage`.

---

## Test Files

### `auth.test.js`
Authentication endpoint tests covering:
- User registration (success, duplicate email, invalid email, short password)
- User login (success, wrong password, non-existent email)
- Edge cases: missing fields, empty body for both register and login
- JWT token structure validation (header.payload.signature format)

### `task.test.js`
Task CRUD endpoint tests covering:
- Create, read (single + paginated list), update, and delete operations
- Authorization checks (unauthenticated access, cross-user access prevention)
- Zod validation (invalid status, missing title, invalid ObjectId)
- Redis cache integration (cache hits, cache invalidation on update/delete)

### `rateLimit.test.js`
Rate limiting behavior tests covering:
- Global rate limiter: 429 response after exceeding 100 requests/minute
- Auth rate limiter: 429 response after exceeding 10 requests/minute on auth routes
- Rate limit header presence (`X-RateLimit-Limit`, `X-RateLimit-Remaining`)
- Stateful transition tests: 200 → 429 as request count increases for both global and auth limiters

### `cacheService.test.js`
Redis caching service tests covering:
- Cache set/get operations with TTL
- Cache invalidation (single key and pattern-based using SCAN)
- Cache miss behavior (returns null, falls back to database)
- Redis error resilience (graceful degradation)

### `notification.test.js`
Notification API tests covering:
- Fetching paginated notifications for authenticated users
- Authorization (unauthenticated access blocked)

### `queueService.test.js`
BullMQ queue service tests covering:
- Job creation for task status changes and assignee updates
- Job data integrity validation
- Queue connection handling

### `bullmq.integration.test.js`
Integration-level BullMQ tests covering:
- End-to-end job processing through the notification worker
- Dead Letter Queue (DLQ) behavior on exhausted retries
- Job retry with exponential backoff

### `worker.test.js`
Worker process tests covering:
- Notification creation from processed jobs
- Error handling in worker processing
- DLQ worker final recovery attempts

### `security.test.js`
Security middleware tests covering:
- Helmet security headers (X-DNS-Prefetch-Control, X-Frame-Options, X-Content-Type-Options, HSTS)
- `X-Powered-By` header removal
- JSON payload size limits (413 on payloads > 100kb)
- CORS configuration (default origin, custom `CORS_ORIGIN` env var)
