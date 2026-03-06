# Trelexa.ai — Codebase Facts

A reference document covering architecture, AI integration, database, memory, and rate limiting — compiled from codebase analysis.

---

## 1. Project Structure

This is an **Nx monorepo** using **pnpm**.

| Folder | Stack | Purpose |
|---|---|---|
| `apps/backend` | NestJS | REST API server |
| `apps/frontend` | Vite + React (Next.js App Router) | Frontend UI |
| `apps/orchestrator` | NestJS + Temporal | Background jobs / workflows |
| `apps/extension` | Browser extension | Social channel connection helper |
| `apps/cli` | Node CLI | Command-line tooling |
| `libraries/` | Shared libs | Services, DB, integrations, UI components |

**Backend architecture rule**: Controller → Service → Repository (no shortcuts). Most server logic lives in `libs/server`.

---

## 2. Database

### Engine
- **PostgreSQL 17** (Alpine) running in Docker
- ORM: **Prisma** — schema at `libraries/nestjs-libraries/src/database/prisma/schema.prisma`
- Migrations run **automatically on app startup**

### Docker volumes (data persistence)
| Volume | Contains |
|---|---|
| `postgres-volume` | All app data |
| `postiz-redis-data` | Redis queue/cache data |
| `postiz-uploads` | Locally uploaded files |

### Dev vs Production — completely separate databases

| | Dev | Production |
|---|---|---|
| Compose file | `docker-compose.dev.yaml` | `docker-compose.yaml` |
| DB credentials | `postiz-local` / `postiz-local-pwd` | `postiz-user` / `postiz-password` |
| DB name | `postiz-db-local` | `postiz-db-local` |
| Data volume | Local machine | VPS |

They never share data unless you explicitly point `DATABASE_URL` at the same server.

**Dev extras**: `docker-compose.dev.yaml` includes **pgAdmin** at `http://localhost:8081` (login: `admin@admin.com` / `admin`) for visual DB browsing.

### Direct DB access
```bash
docker compose exec postiz-postgres psql -U postiz-user postiz-db-local
```

### Backup / Restore
```bash
# Backup
docker compose exec postiz-postgres pg_dump -U postiz-user postiz-db-local > backup.sql

# Restore
docker compose exec -T postiz-postgres psql -U postiz-user postiz-db-local < backup.sql
```

---

## 3. Admin / Roles

### Role enum (Prisma schema)
```
SUPERADMIN → ADMIN → USER
```

### Becoming admin
The **first account registered** automatically receives `SUPERADMIN` role with an **ULTIMATE lifetime subscription** (unlimited channels). This is hardcoded in `organization.repository.ts`.

### Locking down registration
After registering your admin account, set in `.env`:
```
DISABLE_REGISTRATION=true
```
Once set, only the SUPERADMIN can invite new users. Self-registration is blocked (except via GENERIC OAuth provider).

### Manually promote a user via SQL
```sql
UPDATE "UserOrganization" SET role = 'SUPERADMIN'
WHERE "userId" = (SELECT id FROM "User" WHERE email = 'your@email.com');
```

### Role capabilities
| Capability | SUPERADMIN | ADMIN | USER |
|---|---|---|---|
| Full API key access | Yes | Yes | No |
| Invite team members | Yes | Yes | No |
| Manage billing | Yes | Yes | No |
| Connect channels | Yes | Yes | Yes |
| Schedule posts | Yes | Yes | Yes |
| Unlimited channels | Yes (lifetime) | Plan-based | Plan-based |

---

## 4. API Rate Limiting

### Configuration
```
API_LIMIT=99999999   # in docker-compose.yaml and .env.example
```

### How it works (from `apps/backend/src/app.module.ts` + `throttler.provider.ts`)
- **TTL window**: 1 hour (3,600,000 ms) — not per month
- **Scope**: Per **organization** (workspace), not per the whole app
- **Tracker key**: `org.id + '_posts'` — each org gets its own independent counter
- **Only two endpoints are rate-limited**: `/public/v1/posts` and `/public/v1/upload`
- All other routes bypass the throttler entirely

Setting `API_LIMIT=99999999` makes it effectively unlimited per org per hour.

---

## 5. AI Integration

### Key: `OPENAI_API_KEY`
Set in `.env` / `docker-compose.yaml`. Without it, all AI features silently fail or are hidden. The app works fully for scheduling without it.

### AI features powered by OpenAI

| Feature | Model | File |
|---|---|---|
| AI Agent chat (schedule via chat) | `gpt-5.2` (Mastra) | `load.tools.service.ts` |
| Post generation from URL/text | `gpt-4.1` | `openai.service.ts` |
| Thread/post splitting | `gpt-4.1` | `openai.service.ts` |
| Voice script generation | `gpt-4.1` | `openai.service.ts` |
| Video slides from text | `gpt-4.1` | `openai.service.ts` |
| Image generation | `dall-e-3` | `openai.service.ts` |
| Auto-post from RSS | `gpt-4.1` + `dall-e-3` | `autopost.service.ts` |
| CopilotKit chat | `gpt-4.1` | `copilot.controller.ts` |

### Optional AI keys
| Key | Feature |
|---|---|
| `TAVILY_API_KEY` | Web search inside the AI agent (real-time research) |
| HeyGen API key (set in UI per user) | AI avatar video generation |
| `NEXT_PUBLIC_POLOTNO` | Advanced image editor |

### OpenRouter / custom models
**Not wired up yet, but easy to add.** `@openrouter/ai-sdk-provider` is already in `pnpm-lock.yaml` as a transitive dependency.

- **AI Agent** (`load.tools.service.ts`): Uses `@ai-sdk/openai` — swap to `@openrouter/ai-sdk-provider` with ~5 lines
- **Post generation** (`openai.service.ts`): Uses the `openai` npm package — supports `baseURL` override for OpenRouter
- **Image generation (DALL-E 3)**: OpenAI-only — would need a separate key or alternative model if switching providers

---

## 6. AI Prompts — System-based, not per-client

**All prompts are hardcoded system-wide.** There is no per-organization, per-user, or per-post prompt customization built in.

| Feature | Prompt scope | Data scope |
|---|---|---|
| Agent instructions | System-wide (same for all orgs) | Per-org (memory isolated) |
| Auto-post generation | System-wide | Per-org (each org has its own RSS feeds) |
| Post generation | System-wide | Per-request |
| Image generation | System-wide | Per-request |

The only dynamic injection in the agent prompt is the current UTC date/time.

To add per-client custom prompts (brand voice, tone, rules), a `customPrompt` field would need to be added to the `Organization` Prisma model and injected into `load.tools.service.ts` instructions.

---

## 7. Chat Memory Architecture

**Framework**: [Mastra](https://mastra.ai) (`@mastra/core`, `@mastra/memory`, `@mastra/pg`)

### Storage
All memory stored in the **same PostgreSQL database** as the rest of the app:

| Table | Contents |
|---|---|
| `mastra_threads` | Thread metadata — id, title, `resourceId` (= org ID), timestamps |
| `mastra_messages` | Every message — role, content, type, `thread_id` |
| `mastra_resources` | Working memory blob — one row per org, persists across all threads |

### Thread isolation
`resourceId = organization.id` — threads are always filtered by org. Users from different organizations never see each other's conversations.

### 3 memory layers in use

**1. Message History (short-term)**
- Injects the last **40 messages** (Mastra default) of the current thread into every request
- Older messages stay in the DB but fall out of the model's context window

**2. Working Memory (persistent scratchpad)**
- Enabled with a Zod schema: `{ proverbs: string[] }`
- Persists **across all threads** for the same org (resource-scoped)
- The agent can update this JSON object at any time during conversation
- Stored in `mastra_resources` table

**3. Thread title auto-generation**
- `generateTitle: true` — AI automatically names new threads

### What is NOT enabled
| Feature | Status | What it would add |
|---|---|---|
| Semantic recall | Not configured | Vector search across old conversations |
| Observational memory | Not configured | Background summarization of old messages |
| Memory processors | Not configured | Token-limit trimming/compaction |
| Vector DB | Not configured | Required for semantic recall |

### Compaction — not implemented
- Messages accumulate indefinitely in `mastra_messages`
- After 40+ messages, older ones fall out of the model's context window (not sent to GPT) but remain in the DB
- No summarization, no pruning, no token-budget management
- Very long threads will silently lose early context from the model's view

### Memory flow per request
```
User sends message
       │
       ▼
 Last 40 messages of this thread  ──┐
       +                            ├──► Sent to GPT as context
 Working memory (proverbs JSON)  ───┘
       │
       ▼
 GPT responds + optionally updates working memory
       │
       ▼
 Message saved → mastra_messages (PostgreSQL)
 Working memory saved → mastra_resources (PostgreSQL)
```

---

## 8. Deployment (VPS / Docker)

See `DEPLOY.md` in the project root for the full VPS deployment guide.

### Quick reference
```bash
# Start all services
docker compose up -d

# Check logs
docker compose logs -f postiz

# Update to latest
docker compose pull && docker compose up -d

# Restart just the app
docker compose up -d postiz
```

### Caddy (auto-HTTPS)
```
trelexa.ai {
    reverse_proxy localhost:4007
}
```

### Key environment variables
```env
MAIN_URL=https://trelexa.ai
FRONTEND_URL=https://trelexa.ai
NEXT_PUBLIC_BACKEND_URL=https://trelexa.ai/api
JWT_SECRET=<long random string>
DATABASE_URL=postgresql://postiz-user:postiz-password@postiz-postgres:5432/postiz-db-local
REDIS_URL=redis://postiz-redis:6379
IS_GENERAL=true
DISABLE_REGISTRATION=true   # set after first admin registers
OPENAI_API_KEY=sk-proj-...  # optional, enables all AI features
API_LIMIT=99999999
```
