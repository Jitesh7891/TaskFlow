# Architecture & Design Decisions

This document outlines the core architecture of the TaskFlow backend, discussing the "why" behind my design choices, how the system evaluates performance, and the inevitable tradeoffs required to build a secure, resilient platform.

---

## 1. System Overview
The backend leverages a **Monolithic Service Architecture** built with **Node.js** and **Express**, backed by **MongoDB**. To ensure the system performs under extreme load and never blocks the main API thread, I heavily utilize **Redis**, which handles Tiered Rate Limiting, High-Speed Caching, and Background Job Queues (via BullMQ). 

### Separation of Concerns
The project inherently splits the workload into two primary Docker environments:
1.  **API Service:** Handles immediate HTTP requests, authentication, and synchronous validation.
2.  **Worker Service:** An asynchronous background process running entirely independently, listening to Redis for data-intensive notification jobs without penalizing the API's response time.

---

## 2. Distributed Caching & "Auth Before Cache"

### The Decision:
Retrieving complex tasks with joined user relationships directly from MongoDB creates a steep performance penalty. I utilize Redis as a cache-aside layer to hold this data. 

### The Evolution & Tradeoff:
Initially, I cached tasks using a completely global key (`task:123`) and relied on validating permissions against the parsed cached object itself. 
*   **The Flaw:** If background invalidation failed (e.g., a user was removed as an assignee), the cache remained stale. The code then checked the stale object, saw the user was still authorized, and successfully exposed private data.
*   **The Solution ("Auth Before Cache"):** I refactored the pipeline to execute a lightning-fast `.select()` query against the MongoDB source-of-truth strictly to verify permissions *before* I ever look at the cache. If they are authorized, I pull the heavy payload from Redis.
*   **The Tradeoff:** I sacrifice "pure" O(1) cache speed by forcing a mandatory trip to the database for every single request. However, the query is incredibly lightweight, and I gain absolute certainty that data boundaries are bulletproof regardless of caching mistakes.

---

## 3. Asynchronous Job Processing & Dead Letter Queuing (DLQ)

### The Decision:
Sending notifications, triggering emails, or rebuilding heavy indices inside an HTTP request timeline leads to timeouts and a terrible User Experience. I integrated **BullMQ** over Redis to decouple these actions.

### The Problem of Poison Jobs
If an external API (like an email provider) goes down, jobs fail. I initially configured `attempts: 3` with exponential backoff. But if a job continually fails 3 times, I cannot afford to lose the data to the void.
*   **The Solution (DLQ):** I implemented a dedicated **Dead Letter Queue (`dlq`)**. The worker process listens for the `failed` event. If a job exhausts its retries, it is logged as a `[DEAD LETTER]` and immediately shifted to the `dlq` queue. The DLQ worker attempts an eventual success one final time before logging permanent system failure.
*   **The Tradeoff:** BullMQ relies exclusively on Redis. Because Redis resides in volatile memory (RAM), an unexpected hard-crash could result in lost jobs. For a multi-million user system, transitioning these queues to a disk-backed broker like Apache Kafka or RabbitMQ would be safer, but the complexity cost for this scale makes Redis perfect.

---

## 4. Tiered Rate Limiting (Security vs. UX)

### The Decision:
Websites face two primary threats: Application-level DDoS attacks (spamming databases) and Credential Stuffing (botnet guessing passwords). I implemented a "Tiered" Rate Limiting strategy.

### 1. Global Rate Limiter (UX Focused)
*   **Configuration:** `100 requests / 1 minute`
*   **Mechanism:** If the user sends a JWT token, they are bucketed by their unique `userId`. If they don't, they are bucketed by their IP address. 
*   **Why:** By bucketing authenticated users by their exact database ID, I avoid the **"NAT Pool" problem**. If 50 students use my app on a university campus, they share the exact same public IP address. Standard IP limiting would ban all 50 students simultaneously.

### 2. Auth Rate Limiter (Security Focused)
*   **Configuration:** `10 requests / 1 minute`
*   **Mechanism:** Strictly applied ONLY to the `/auth/login` and `/auth/register` routes. This limiter completely ignores authentication status and strictly buckets users by raw IP Address.
*   **Why:** This actively suffocates brute-force attacks and credential stuffing scripts. 
*   **The Tradeoff:** If multiple legitimate users operating from the same office IP mistype their passwords simultaneously, they could momentarily trigger a ban for their coworkers. This minimal UX friction easily offsets the massive risk of unauthorized access.
