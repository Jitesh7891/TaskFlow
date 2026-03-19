# TaskFlow - Full Stack Task Management System 🚀

A robust, production-ready task management application demonstrating backend concepts including **Distributed Caching**, **Rate Limiting**, **Background Job Processing**, and **Authentication**.

## 🎥 Demo Capabilities

### 1. ⚡ Redis Caching (Performance)
**Goal:** Demonstrate high-performance data retrieval.
1. Run `npm run dev`.
2. Access the **"Tasks"** tab.
   - **Log:** `[Cache] MISS` (Database read)
3. Access the **"Tasks"** tab again.
   - **Log:** `[Cache] HIT` (Instant Redis read)

### 2. 🛡️ Rate Limiting (Security)
**Goal:** Demonstrate API protection.
1. Observe the **limit bar** (60 requests/min).
2. Rapidly refresh the page.
3. API blocks requests with `429 Too Many Requests` when limit is reached.

### 3. 📨 Background Workers (Async Processing)
**Goal:** Demonstrate decoupled architecture using BullMQ.
1. Create a task and assign it to another user.
2. Watch the **Worker Terminal** for real-time processing logs:
   ```
   ----------------------------------------
   ✅ [Worker] Job COMPLETED
      Action: Saved to MongoDB
   ----------------------------------------
   ```
3. The assigned user receives the notification upon refresh.

### 4. ✅ Code Quality (Verification)
**Goal:** Prove reliability.
1. Run `npm test -- --coverage`.
2. **Result:** Suite passes with **~85% Coverage**.

---

## 🛠️ Tech Stack

- **JWT Authentication** - Secure user registration and login
- **Task Management** - CRUD operations with permissions
- **Redis Caching** - Cache-aside pattern for API responses (60s TTL)
- **Rate Limiting** - Redis-based, 60 requests/minute per user
- **Async Notifications** - BullMQ queue with worker process
- **Dockerized** - Full stack containerization with Docker Compose
- **Reliability** - **85% Test Coverage** (Jest + Supertest)



## Project Structure

```
├── src/                 # Backend
│   ├── config/          # DB, Redis, Queue configs
│   ├── controllers/     # Route handlers
│   ├── middlewares/     # Auth, rate limit, errors
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express routers
│   ├── services/        # Business logic
│   └── utils/           # Validators, helpers
├── worker/              # BullMQ worker process
├── tests/               # Jest test suites
├── client/              # React frontend
│   └── src/
│       ├── pages/       # Auth, Tasks, Notifications
│       ├── services/    # API client
│       └── context/     # Auth context
└── .github/workflows/   # CI configuration
```

## Prerequisites

- Node.js 18+
- MongoDB
- Redis

## 🐳 Quick Start (Docker)

The easiest way to run the project. Requires **Docker** and **Docker Compose**.

1.  **Clone the repo:**
    ```bash
    git clone <repo-url>
    cd taskflow
    ```

2.  **Run with Docker Compose:**
    ```bash
    docker-compose up --build
    ```
    *Builds images and starts API, Worker, Client, Redis, and MongoDB.*

3.  **Access the App:**
    -   Frontend: http://localhost:5173
    -   API: http://localhost:3000

4.  **View Demo Logs (Important!):**
    -   To see **Worker logs** (for assignments):
        ```bash
        docker-compose logs -f worker
        ```
    -   To see **API logs** (for cache hits):
        ```bash
        docker-compose logs -f api
        ```

---

## 🛠️ Manual Setup (No Docker)

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services:**

   **API Server:**
   ```bash
   npm run dev       # Development with hot reload
   npm start         # Production
   ```

   **Worker (separate terminal):**
   ```bash
   npm run worker:dev   # Development
   npm run worker       # Production
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

5. **Start frontend (separate terminal):**
   ```bash
   cd client
   npm run dev
   ```
   Open http://localhost:5173

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, returns JWT |

### Tasks (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tasks` | Create task |
| GET | `/tasks` | List tasks (paginated, cached) |
| GET | `/tasks/:id` | Get single task (cached) |
| PATCH | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task (creator only) |

### Notifications (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications (paginated) |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `MONGODB_URI` | MongoDB connection string | - |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | Token expiry | 7d |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 60000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 60 |

## Cache Keys

- Task list: `tasks:user:{userId}:page:{page}:limit:{limit}`
- Single task: `task:{taskId}`
- Rate limit: `ratelimit:{userId|ip}`

TTL: 60 seconds

## Notification Queue

Queue: `notifications`

Job types:
- `task_assigned` - When task is assigned
- `task_status_updated` - When status changes

Config: 3 retries with exponential backoff

## License

ISC
