# Teamsight — Server

Express + Socket.io backend for [Teamsight](https://github.com/TWSNXDev/teamsight), a real-time sales dashboard. Handles auth, the sales data API, WebSocket broadcasts, and the AI insight/chat endpoints.

Runs as its own long-running process rather than serverless functions, because the WebSocket layer needs a persistent connection — see the [frontend repo](https://github.com/TWSNXDev/teamsight) for the full architecture writeup.

## Stack

- **Express 5** — REST API
- **Socket.io** — real-time broadcasts, authenticated per-connection via the session cookie
- **Prisma + PostgreSQL** — data layer, with a raw driver adapter (`@prisma/adapter-pg`) rather than Prisma's older embedded engine
- **Better Auth** — email/password sessions, extended with `role` and `teamId` fields for access control
- **OpenRouter** (via the `openai` SDK, pointed at a different `baseURL`) — model-agnostic AI calls; swapping providers or models is a single env var, no code changes

## API surface

| Route | What it does |
|---|---|
| `POST /api/auth/*` | Handled entirely by Better Auth (sign-up, sign-in, session) |
| `GET/POST/PATCH/DELETE /api/sales-records` | CRUD for sales records, RBAC-checked on every write |
| `GET /api/teams` | List teams |
| `POST /api/insights` | Streams an AI-generated summary of recent sales |
| `POST /api/chat` | Streams a follow-up-question chat, grounded in the same sales data |

Real-time events (`sales-record:created/updated/deleted`, `online-users`) are broadcast over Socket.io whenever a write succeeds.

## Notable decisions

**Role checks happen on every route, not just in middleware that gates access entirely.** A Manager can write to `/api/sales-records`, but the handler still checks that the specific record's `teamId` matches their own before allowing it — the blanket auth check and the per-resource ownership check are separate steps.

**Edits use optimistic concurrency instead of locking.** `PATCH` requests include the `updatedAt` the client last saw; if it doesn't match what's in the database, the request is rejected with a 409 rather than silently overwriting a change someone else just made.

**AI prompts are built from pre-computed aggregates, not raw records.** `sales-context.ts` computes this-week vs. last-week totals and per-team breakdowns in SQL/Prisma before anything reaches the model, and the prompt explicitly tells it to only use those numbers. Cheaper, and it doesn't get to invent a trend that isn't in the data.

## Environment variables

```
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
FRONTEND_URL=
PORT=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

## Running it locally

```bash
pnpm install
docker compose up -d          # local Postgres
pnpm exec prisma migrate dev
pnpm exec tsx prisma/seed.ts  # optional: seeds teams, demo users, sample records
pnpm dev
```
