# TaskFlow - Full Stack Task Management System 🚀

TaskFlow is a production-ready **Task Manager / Backend System** that demonstrates advanced enterprise backend concepts. It focuses on resilience, security, and decoupled performance using a modern Node.js stack.

## ✨ Core Features

### 1. 🛡️ Tiered Rate Limiting (Security)
The system leverages Redis to implement a smart, tiered rate-limiting strategy:
*   **Global Limiter:** Limits general API traffic to `100 requests/minute`. It groups authenticated users by their exact Database ID (`userId`) to prevent mass False-Positive bans for users sharing the same public IP (e.g. WiFi networks).
*   **Auth Limiter:** A hyper-strict shield over `/auth/login` and `/auth/register` that ignores user tokens and locks down by raw IP Address (`10 requests/minute`), suffocating botnets and credential-stuffing attacks.

### 2. ⚡ Secure Redis Caching ("Auth Before Cache")
To optimize performance without sacrificing security, I use a robust cache-aside pattern with a 60s TTL.
*   **Data Integrity:** Rather than authorizing users strictly against potentially stale cached tasks, the system runs a micro-query against the database source-of-truth ensuring absolute permission validation (*before* hitting the cache).
*   **Non-Blocking Invalidation:** Cache purging uses Redis `SCAN` (cursor-based) instead of `KEYS` to avoid blocking the Redis event loop at scale.

### 3. 📨 Background Jobs & Dead Letter Queue (DLQ)
Notifications (assigning tasks, status updates) are completely decoupled from the main thread using **BullMQ**.
*   **Resiliency:** Background jobs auto-retry 3 times with exponential backoff on failure.
*   **Dead Letter Queue (DLQ):** If an external integration stays down and exhausts retries, the job is caught, logged as a `[DEAD LETTER]`, and moved to the safety of a permanent `dlq` queue for a final recovery execution or manual review.

### 4. ✅ Automated Testing (Code Quality)
I rely on **Jest** and **Supertest** to validate all authentication, caching, BullMQ logic, and Rate Limiting ceilings. The test suite maintains an ~85% total code coverage.

---

## 🛠️ Tech Stack
*   **Backend:** Node.js, Express, Zod (Validation), JWTS
*   **Database:** MongoDB (Mongoose)
*   **High-Speed Memory:** Redis (ioredis)
*   **Background Jobs:** BullMQ
*   **Logging:** Pino (`pino-http`)
*   **Containerization:** Docker & Docker Compose
*   **Testing:** Jest, Supertest, MongoDB-Memory-Server

## 📖 Architecture & Design Decisions
Please see `architecture.md` for a comprehensive breakdown of why and how certain tools and strategies were chosen, alongside their system tradeoffs.

---

## 🐳 Quick Start (Docker)

1.  **Clone the repo:**
    ```bash
    git clone <repo-url>
    cd project
    ```

2.  **Run with Docker Compose:**
    ```bash
    docker-compose up --build -d
    ```
    *Builds images and starts API, Worker, Redis, and MongoDB.*

3.  **Access the APIs:**
    -   API Base: http://localhost:3000
    -   Interactive Documentation: http://localhost:3000/api-docs

## API Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user (Strict IP Rate Limit) |
| POST | `/auth/login` | Login, returns JWT (Strict IP Rate Limit) |
| POST | `/tasks` | Create generic task |
| GET | `/tasks` | Paginated tasks listing |
| PATCH | `/tasks/:id` | Update Task (Triggers Background Job) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (Default: 3000) |
| `MONGODB_URI` | MongoDB Connection String |
| `REDIS_HOST` | Redis Server IP |
| `JWT_SECRET` | Secret key to sign tokens |

## License
ISC
