# TaskFlow - Backend Task Management System 🚀

TaskFlow is a production-ready **Backend System** that demonstrates advanced enterprise backend concepts. It focuses on resilience, security, and decoupled performance using a modern Node.js stack.

## ✨ Core Features

### 1. 🛡️ Tiered Rate Limiting (Security)
The system leverages Redis to implement a smart, tiered rate-limiting strategy:
*   **Global Limiter:** Limits general API traffic to `100 requests/minute`. A lightweight `extractUserId` middleware decodes the JWT *before* the rate limiter runs, allowing authenticated users to be bucketed by their exact Database ID (`userId`) — preventing mass false-positive bans for users sharing the same public IP (e.g. campus WiFi).
*   **Auth Limiter:** A hyper-strict shield over `/auth/login` and `/auth/register` that ignores user tokens and locks down by raw IP Address (`10 requests/minute`), suffocating botnets and credential-stuffing attacks.

### 2. ⚡ Secure Redis Caching ("Auth Before Cache")
To optimize performance without sacrificing security, I use a robust cache-aside pattern with a 60s TTL. Redis caching saves **70-80% API response latency** on cache hits.
*   **Data Integrity:** Rather than authorizing users strictly against potentially stale cached tasks, the system runs a micro-query against the database source-of-truth ensuring absolute permission validation (*before* hitting the cache).
*   **Non-Blocking Invalidation:** Cache purging uses Redis `SCAN` (cursor-based) instead of `KEYS` to avoid blocking the Redis event loop at scale.

### 3. 📨 Background Jobs & Dead Letter Queue (DLQ)
Notifications (assigning tasks, status updates) are completely decoupled from the main thread using **BullMQ**.
*   **Resiliency:** Background jobs auto-retry 3 times with exponential backoff on failure.
*   **Dead Letter Queue (DLQ):** If an external integration stays down and exhausts retries, the job is caught, logged as a `[DEAD LETTER]`, and moved to the safety of a permanent `dlq` queue for a final recovery execution or manual review.

### 4. ✅ Automated Testing (Code Quality)
I rely on **Jest** and **Supertest** to validate all authentication, caching, BullMQ logic, and Rate Limiting ceilings. The test suite maintains >90% total code coverage. See [`tests.md`](tests.md) for full details.

---

## 🛠️ Tech Stack
*   **Runtime:** Node.js 18
*   **Backend:** Express, Zod (Validation), JWT (Authentication)
*   **Database:** MongoDB Atlas (Mongoose)
*   **Cache & Queues:** Redis Cloud (ioredis), BullMQ
*   **Logging:** Pino (`pino-http`)
*   **Security:** Helmet, bcrypt, Tiered Rate Limiting
*   **Containerization:** Docker & Docker Compose
*   **Testing:** Jest, Supertest, MongoDB-Memory-Server
*   **CI:** GitHub Actions

## 📖 Architecture & Design Decisions
Please see [`architecture.md`](architecture.md) for a comprehensive breakdown of why and how certain tools and strategies were chosen, alongside their system tradeoffs.

---

## 🚀 Quick Start (Local)

### Prerequisites
*   **Node.js 18+** and npm
*   **MongoDB** (Optional if using Docker)
*   **Redis** (Optional if using Docker)

### Setup

1.  **Clone the repo:**
    ```bash
    git clone https://github.com/Jitesh7891/TaskFlow.git
    cd TaskFlow
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure environment variables:**
    ```bash
    cp .env.example .env
    ```
    The defaults work when MongoDB and Redis are running on your machine (including
    when started through Docker with `docker compose up -d mongo redis`).

4.  **Start MongoDB and Redis** (skip this if you run them natively):
    ```bash
    docker compose up -d mongo redis
    ```

5.  **Start the API server:**
    ```bash
    npm run dev
    ```

6.  **Start the background worker** (in a separate terminal):
    ```bash
    npm run worker:dev
    ```

7.  **Open the interactive API documentation:**

    👉 **http://localhost:3000/api-docs** — Swagger UI with all endpoints, request/response schemas, and authentication built in. Register a user, grab the JWT, and test every endpoint directly from the browser.

---

## 🐳 Docker Setup (Alternative)

If you prefer Docker, the compose file spins up the **entire stack** (API, Worker, MongoDB, and Redis) locally for you:

```bash
docker compose up --build -d
```

> **Note:** The included `docker-compose.yml` mounts local volumes. Your database data will safely persist between container restarts!

---

## 🧪 Running Tests

```bash
npm test
```

**Test Coverage:** 91.6% statements, 70.7% branches, 89.1% functions, 92.0% lines (overall >90%).

Tests use **MongoDB-Memory-Server** (in-memory database) and **mocked Redis/BullMQ** — no external services required.

For BullMQ integration tests (requires a running Redis):
```bash
npx jest tests/bullmq.integration.test.js
```

---

## 📋 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ✗ | Register new user (Strict IP Rate Limit) |
| POST | `/auth/login` | ✗ | Login, returns JWT (Strict IP Rate Limit) |
| GET | `/auth/users` | ✓ | List all users (for task assignment/demo) |
| POST | `/tasks` | ✓ | Create a new task |
| GET | `/tasks` | ✓ | Paginated task listing |
| GET | `/tasks/:id` | ✓ | Get a single task by ID |
| PATCH | `/tasks/:id` | ✓ | Update task (triggers background notification job) |
| DELETE | `/tasks/:id` | ✓ | Delete a task permanently |
| GET | `/notifications` | ✓ | Paginated notifications |
| GET | `/health` | ✗ | Health check |
| GET | `/api-docs` | ✗ | **Swagger UI — Interactive API Documentation** |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (Default: `3000`) |
| `MONGODB_URI` | **Yes** | MongoDB connection string |
| `REDIS_URL` | **Yes** | Redis connection URL (e.g. `redis://localhost:6379`) |
| `JWT_SECRET` | **Yes** | Secret key to sign JWT tokens |
| `JWT_EXPIRES_IN` | No | Token expiry duration (Default: `7d`) |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window in ms (Default: `60000`) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per window (Default: `100`) |
| `CORS_ORIGIN` | No | Restrict CORS to a specific origin (Default: `*` — open) |

## License
ISC
