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

## 8. Stripe, Payments & Subscription Capping

### Overview
Stripe is **optional**. If `STRIPE_PUBLISHABLE_KEY` is not set (self-hosted default), **all permission checks are bypassed** and every user gets full `ULTIMATE`-level access (10,000 channels, unlimited posts, all AI features). No billing UI appears.

### Plan Tiers (`libraries/nestjs-libraries/src/database/prisma/subscriptions/pricing.ts`)

| Tier | Price | Channels | Posts/mo | AI | Team | Webhooks |
|---|---|---|---|---|---|---|
| FREE | $0 | 0 | 0 | No | No | 0 |
| STANDARD | $29 | 5 | 400 | Yes | No | 2 |
| TEAM | $39 | 10 | unlimited | Yes | Yes | 10 |
| PRO | $49 | 30 | unlimited | Yes | Yes | 30 |
| ULTIMATE | $99 | 100 | unlimited | Yes | Yes | 10,000 |

### Database Models (billing-relevant)

**`Organization`** fields: `paymentId` (Stripe customer ID), `allowTrial` (one-time trial eligibility), `isTrailing` (currently in trial).

**`Subscription`** fields: `organizationId` (unique), `subscriptionTier`, `period` (MONTHLY/YEARLY), `totalChannels`, `isLifetime`, `cancelAt`, `deletedAt`.

**`Credits`** table: tracks AI image/video usage per org per billing cycle.

**`UsedCodes`** table: prevents lifetime deal code reuse.

### How Feature Limits Are Enforced

A global `PoliciesGuard` runs on every protected route. Controllers declare requirements with `@CheckPolicies()`:

```typescript
@CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
async createPost(...) { ... }
```

The guard calls `PermissionsService.check()` which compares live usage against `pricing[tier]`:

| Section | What is counted |
|---|---|
| `CHANNEL` | Active integrations vs `subscription.totalChannels` |
| `POSTS_PER_MONTH` | Posts since billing cycle start vs `pricing[tier].posts_per_month` |
| `WEBHOOKS` | Total webhooks vs `pricing[tier].webhooks` |
| `TEAM_MEMBERS` / `AI` / `IMPORT_FROM_CHANNELS` etc. | Boolean feature flags from `pricing` |

When a limit is exceeded → HTTP **402** is returned with a redirect to `/billing`.

### Stripe Webhook Flow

```
Stripe → POST /stripe (stripe.controller.ts)
           ↓ verify signature (STRIPE_SIGNING_KEY)
  subscription.created/updated → createOrUpdateSubscription()
           ↓
     modifySubscription()  ← enforces channel/team limits immediately
           ↓
     upsert Subscription record in DB
           ↓
     set org.isTrailing, org.allowTrial = false

  subscription.deleted → deleteSubscription()
           ↓
     downgrade to FREE, disable excess channels
```

### Billing Controller Routes (`apps/backend/src/api/routes/billing.controller.ts`)

| Route | Description |
|---|---|
| `POST /billing/subscribe` | Create/upgrade subscription (redirect checkout) |
| `POST /billing/embedded` | Embedded Stripe Checkout session |
| `GET /billing/portal` | Stripe billing portal URL |
| `GET /billing/` | Current subscription record |
| `POST /billing/cancel` | Cancel at period end |
| `POST /billing/prorate` | Calculate proration for plan change |
| `GET /billing/check/:id` | Poll for subscription activation |
| `POST /billing/finish-trial` | End trial immediately |
| `GET /billing/is-trial-finished` | Check trial status |
| `POST /billing/lifetime` | Redeem lifetime deal code |
| `POST /billing/add-subscription` | SUPERADMIN only: manually assign tier |
| `GET /billing/crypto` | Crypto payment via NowPayments |

### Trial System
- Every new org gets `allowTrial: true` (one-time)
- At checkout, if `allowTrial` → Stripe adds `trial_period_days: 7`
- After webhook fires → `allowTrial = false` permanently
- During trial, video content is blocked (`if (!video.trial && org.isTrailing) throw 406`)
- Users can end trial early via `POST /billing/finish-trial`

### Lifetime Deals
- First code → grants `STANDARD` (5 channels)
- Second code on same org → upgrades to `PRO`
- `isLifetime: true` makes the subscription immune to downgrade webhooks

### AI Credit Tracking
`useCredit()` wraps every AI image/video call — pre-creates a `Credits` record, runs the function, rolls back the credit if it fails. Credits reset each billing cycle.

---

## 9. Financial Admin — App vs. Stripe

### What the App Has (SUPERADMIN only)

There is **no financial dashboard built into the app**. The only admin capabilities are:

| Feature | Endpoint | Notes |
|---|---|---|
| **Impersonate any user** | `GET /user/impersonate?name=...` + `POST /user/impersonate` | SUPERADMIN can log in as any user |
| **Manually assign subscription** | `POST /billing/add-subscription` | Grant a tier without Stripe |
| **Lifetime deal codes** | `POST /billing/lifetime` | Redeem encrypted codes |

### What Lives Only in Stripe Dashboard
- Revenue / MRR / ARR
- All invoices and payment history
- Customer list with subscription status
- Refunds and disputes
- Coupon/discount management
- Subscription upgrade/downgrade history
- Failed payment retries (Smart Retries)
- Tax / VAT (if Stripe Tax configured)

### Self-Hosted (No Stripe)
With `STRIPE_PUBLISHABLE_KEY` unset, all billing gates are bypassed. The only admin tool is **impersonation** — the SUPERADMIN can log in as any user to troubleshoot. Financial tracking must be done externally (e.g., pgAdmin queries against the `Subscription` and `Organization` tables).

---

## 10. CLI (`apps/cli`)

The CLI is a compiled Node.js tool (single `dist/index.js` bundle) for automating Trelexa.ai via the public API.

### Setup
```bash
# Required
export TRELEXA_API_KEY=your_api_key_here

# Optional — defaults to http://localhost:3000 (local dev)
export TRELEXA_API_URL=https://trelexa.ai
```

Get your API key from **Settings → API Keys** in the UI (ADMIN or SUPERADMIN only).

### Commands
```bash
node apps/cli/dist/index.js integrations:list
node apps/cli/dist/index.js posts:list
node apps/cli/dist/index.js posts:create -c "Hello!" -i "integration-id"
node apps/cli/dist/index.js posts:delete <id>
node apps/cli/dist/index.js upload ./image.png
node apps/cli/dist/index.js integrations:settings <integration-id>
node apps/cli/dist/index.js integrations:trigger <integration-id> <method>
```

### Key files
| File | Purpose |
|---|---|
| `apps/cli/dist/index.js` | Compiled bundle (patched for Trelexa.ai branding) |
| `apps/cli/package.json` | Package name: `trelexa`, binary: `trelexa` |
| `apps/cli/README.md` | Full command reference |
| `apps/cli/QUICK_START.md` | Quick start guide |
| `apps/cli/SKILL.md` | AI agent integration patterns |

---

## 11. Deployment (VPS / Docker)

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

---

### Infrastructure Requirements

**Minimum server specs**: 4 vCPUs, 8 GB RAM (Temporal + Elasticsearch are heavy), 20 GB disk, Linux + Docker.

**Required services** (all included in `docker-compose.yaml`):

| Service | Version | Purpose |
|---|---|---|
| PostgreSQL | 17 | Primary database |
| Redis | 7.2+ | Queue, caching, sessions |
| Temporal | 1.28.1 | Background job orchestration |
| Elasticsearch | 7.17.x | Required by Temporal for workflow visibility |

**Ports** (only app port should be public):

| Port | Service | Exposure |
|---|---|---|
| `4007` | Trelexa.ai app | Public (via reverse proxy) |
| `5432` | PostgreSQL | Internal only |
| `6379` | Redis | Internal only |
| `7233` | Temporal gRPC | Internal only |
| `8080` | Temporal UI | Internal/admin only |
| `9200` | Elasticsearch | Internal only |

---

### File Storage — Choose One

**Option A — Local** (simple, files live on your server):
```env
STORAGE_PROVIDER=local
UPLOAD_DIRECTORY=/uploads
NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY=/uploads
```

**Option B — Cloudflare R2** (recommended — cheap, CDN-backed, required for social media avatars):
```env
STORAGE_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_ACCESS_KEY=...
CLOUDFLARE_SECRET_ACCESS_KEY=...
CLOUDFLARE_BUCKETNAME=trelexa-media
CLOUDFLARE_BUCKET_URL=https://xxx.r2.cloudflarestorage.com/
CLOUDFLARE_REGION=auto
```

---

### Email Setup — Choose One Provider

Without email, users auto-activate (fine for invite-only). Required for user activation emails and cancellation alerts.

**Resend** (recommended — free tier: 3,000 emails/mo):
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM_ADDRESS=hello@trelexa.ai
EMAIL_FROM_NAME=Trelexa.ai
```

**SMTP / NodeMailer**:
```env
EMAIL_PROVIDER=nodemailer
EMAIL_FROM_ADDRESS=hello@trelexa.ai
EMAIL_FROM_NAME=Trelexa.ai
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=...
EMAIL_PASS=...
```

---

### Stripe Setup (To Accept Payments)

Without `STRIPE_PUBLISHABLE_KEY`, billing is fully disabled and all users get unlimited access for free. Set these three vars to enforce subscription tiers.

**Steps:**
1. Create account at [stripe.com](https://stripe.com)
2. Get API keys from Developers → API Keys
3. Create a webhook at `https://trelexa.ai/api/stripe` for events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
4. Copy the webhook signing secret

```env
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_SIGNING_KEY=whsec_...
```

The app auto-creates Stripe Products and Prices on first checkout — no manual Stripe product setup needed.

---

### Social Platform OAuth Apps

Each platform requires a registered OAuth app. All are optional — only configure the platforms you want to offer.

**Callback URL pattern for all platforms**: `https://trelexa.ai/integrations/social/{platform}`

| Platform | Effort | Env Vars |
|---|---|---|
| X/Twitter | Medium | `X_API_KEY`, `X_API_SECRET` |
| LinkedIn | Low | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Facebook + Instagram | High (app review) | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` |
| YouTube / Google | Low | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` |
| TikTok | High (business verification) | `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET` |
| Pinterest | Low | `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` |
| Reddit | Low | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` |
| Discord | Low | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN_ID` |
| Slack | Low | `SLACK_ID`, `SLACK_SECRET`, `SLACK_SIGNING_SECRET` |
| Telegram | Very low (BotFather) | `TELEGRAM_TOKEN`, `TELEGRAM_BOT_NAME` |
| Threads | Medium (Meta app) | `THREADS_APP_ID`, `THREADS_APP_SECRET` |
| Mastodon | Low | `MASTODON_URL`, `MASTODON_CLIENT_ID`, `MASTODON_CLIENT_SECRET` |
| Twitch | Low | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` |

**Platforms requiring no server keys** (users connect with their own credentials — work out of the box): Bluesky, Medium, Hashnode, Dev.to, WordPress, Nostr.

---

### AI Features

```env
OPENAI_API_KEY=sk-proj-...        # Enables all AI features (post gen, agent, images)
TAVILY_API_KEY=tvly-...           # Adds web search to the AI agent (optional)
```

Full video slides feature additionally requires:
```env
ELEVENSLABS_API_KEY=...           # Text-to-speech
FAL_KEY=...                       # Image generation
TRANSLOADIT_AUTH=...              # Video processing
TRANSLOADIT_SECRET=...
TRANSLOADIT_TEMPLATE=...
```

---

### Optional Integrations

**Short link services** (pick at most one):
```env
DUB_TOKEN=...                     # dub.co
DUB_SHORT_LINK_DOMAIN=dub.sh
# or
SHORT_IO_SECRET_KEY=...           # short.io
# or
KUTT_API_KEY=...                  # kutt.it (self-hostable)
```

**Analytics & tracking**:
```env
NEXT_PUBLIC_POSTHOG_KEY=...       # PostHog product analytics
NEXT_PUBLIC_POSTHOG_HOST=...
NEXT_PUBLIC_FACEBOOK_PIXEL=...    # Facebook Pixel
```

**Error tracking**:
```env
NEXT_PUBLIC_SENTRY_DSN=...        # Sentry error tracking
```

**Generic SSO / OIDC login** (Authentik, Keycloak, Auth0, etc.):
```env
POSTIZ_GENERIC_OAUTH=true
POSTIZ_OAUTH_URL=...
POSTIZ_OAUTH_AUTH_URL=...
POSTIZ_OAUTH_TOKEN_URL=...
POSTIZ_OAUTH_USERINFO_URL=...
POSTIZ_OAUTH_CLIENT_ID=...
POSTIZ_OAUTH_CLIENT_SECRET=...
NEXT_PUBLIC_POSTIZ_OAUTH_DISPLAY_NAME=Authentik
```

---

### Recommended Go-Live Order

```
Week 1:  VPS + Docker + DNS + SSL + core env vars  → app is running
Week 1:  Cloudflare R2 storage                     → media uploads work
Week 1:  Resend email                              → user activation works
Week 1:  Stripe                                    → billing active, money flows
Week 2:  LinkedIn + YouTube + Reddit + Telegram    → quick wins (low-effort OAuth)
Week 2:  X/Twitter + Pinterest + Discord + Slack   → medium effort
Week 3+: Facebook/Instagram + TikTok               → require app review, start early
Ongoing: OpenAI key                                → AI features unlocked
```

---

### Security Checklist Before Going Live

- [ ] `DISABLE_REGISTRATION=true` after admin account is created
- [ ] `NOT_SECURED` is **not set** (ensures `Secure` cookies in production)
- [ ] `JWT_SECRET` is a long random string (32+ chars)
- [ ] PostgreSQL and Redis ports are **not** exposed publicly
- [ ] Temporal UI (port 8080) is **not** exposed publicly
- [ ] All `*_URL` variables use `https://`
- [ ] Stripe webhook secret is set (`STRIPE_SIGNING_KEY`)
- [ ] Cloudflare R2 bucket is not publicly writable

---

## 12. Newsletter & Email List

The app automatically adds every new user to a newsletter list on registration/activation. Uses a provider-pattern abstraction — configure one provider via env vars.

### Provider Selection (priority order)
1. **Beehiiv** — if `BEEHIIVE_API_KEY` is set
2. **Listmonk** — if `LISTMONK_API_KEY` is set
3. **No-op** — silent fallback (nothing sent)

### Beehiiv (hosted, free up to 2,500 subscribers)
```env
BEEHIIVE_API_KEY=...
BEEHIIVE_PUBLICATION_ID=...
```
Sends `{ email, reactivate_existing: false, send_welcome_email: true, utm_source: 'gitroom_platform' }` to Beehiiv on signup.

### Listmonk (self-hosted)
```env
LISTMONK_DOMAIN=https://your-listmonk-instance.com
LISTMONK_USER=admin
LISTMONK_API_KEY=...
LISTMONK_LIST_ID=...
LISTMONK_WELCOME_TEMPLATE_ID=...
```
Creates subscriber then immediately sends a transactional welcome email with subject `"Welcome to Trelexa.ai 🚀"`.

### What triggers signup
Fires in exactly two places (`apps/backend/src/services/auth/auth.service.ts`):
1. OAuth registration (Google, GitHub, etc.) — fires immediately after account creation
2. Email/password registration — fires after the user clicks the activation link

**Only the email address is captured** — no name, no UTM data, no custom fields.

---

## 13. Conversion & Funnel Tracking

A complete multi-layer tracking stack is already built in. Most features activate via env vars with no code changes.

### Facebook Conversions API (server-side)
Full server-side event tracking with SHA-256 hashed emails and `fbclid` cookie attribution.

```env
NEXT_PUBLIC_FACEBOOK_PIXEL=...       # Pixel ID
FACEBOOK_PIXEL_ACCESS_TOKEN=...      # Conversions API token
```

Events already wired up:

| Event | When |
|---|---|
| `CompleteRegistration` | User registers |
| `InitiateCheckout` | User opens billing page |
| `StartTrial` | User starts trial (post-checkout redirect) |
| `Purchase` | User completes checkout |

### Facebook Pixel (client-side)
Injects the `fbq` pixel script via a local `/f.js` proxy (not directly from Facebook CDN). Active when `NEXT_PUBLIC_FACEBOOK_PIXEL` is set.

### PostHog (product analytics)
```env
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=...         # default: https://app.posthog.com
```
Identifies users by `user.id` with email and name. Only fires when Stripe is configured (`billingEnabled`).

### Plausible (page analytics)
Domain hardcoded to `trelexa.ai` in `apps/frontend/src/app/(app)/layout.tsx`. No env var needed — just set up the domain in your Plausible account.

### Datafast (registration tracking)
```env
DATAFAST_API_KEY=...
DATAFAST_WEBSITE_ID=...
```
Fires a `register` goal event on every new user registration.

### UTM / Referral Attribution
Automatically saves to `localStorage` on first visit — no setup needed:
- `utm_source`, `utm`, `ref` query params
- `landingUrl` and `document.referrer`

On `?check=` query param (post-checkout redirect): fires `'purchase'` PostHog event + `StartTrial` Facebook event.

### Dub.co Affiliate Tracking
```env
# No env var needed — uses affiliate.trelexa.ai domain
# Active automatically when STRIPE_PUBLISHABLE_KEY is set
```
Uses `@dub/analytics/react` with `affiliate.trelexa.ai`. Reads `dub_partner_data` cookie for click attribution.

---

## 14. Automated Transactional Emails

These fire automatically with no additional setup beyond configuring an email provider (see Section 11 — Email Setup).

### Digest System
Post publish/failure notifications are **batched into hourly digests** via a Temporal workflow — users get one email per hour maximum, not one per post. Users can toggle these in Settings.

### All Automated Emails

| Email | Trigger | Digest? |
|---|---|---|
| Account activation | New local/email registration | No |
| Team invite | User invited to an organization | No |
| Post published | Post goes live on a platform | Yes (hourly) |
| Post failed | Publishing error on a platform | Yes (hourly) |
| Channel refresh error | OAuth token expired/invalid | No |
| Channel disabled | Platform repeatedly fails to post | No |
| Streak reminder | "Lose your streak in 2 hours" | No |
| Password reset | Forgot password flow | No |
| Agency submitted (admin) | New agency directory submission | No — goes to admin email |
| Agency approved | Agency listing approved | No |
| Agency declined | Agency listing declined | No |

### User Email Preferences (configurable in Settings UI)
- `sendSuccessEmails` — post published notifications (default: on)
- `sendFailureEmails` — post failed notifications (default: on)
- `sendStreakEmails` — streak reminder (default: on)

### ⚠️ Agency Admin Email — Change This
The agency approval notification is hardcoded to `nevo@postiz.com` in:
`libraries/nestjs-libraries/src/database/prisma/agencies/agencies.service.ts`

Change it to your own email address before going live.

---

## 15. Agencies Directory

A built-in **public agency marketplace** where users can list their social media agency for clients to discover.

### How it works
1. A user submits their agency profile (name, description, website, social links, niches)
2. Submission triggers an approval email to the admin (see warning above)
3. Admin clicks approve/decline link in the email
4. Approved agencies are publicly listed at `https://trelexa.ai/agencies/{slug}`

### Agency Profile Fields
`name`, `slug` (auto-generated), `logoId`, `website`, `shortDescription`, `description`, `niches` (many-to-many), `facebook`, `instagram`, `twitter`, `linkedIn`, `youtube`, `tiktok`, `otherSocialMedia`

### Public API Endpoints
| Endpoint | Description |
|---|---|
| `GET /public/agencies-list` | All approved agencies |
| `GET /public/agencies-information/:slug` | Single agency by slug |
| `GET /public/agencies-list-count` | Count of approved agencies |

### `featured_by_gitroom` Pricing Flag
Available on TEAM/PRO/ULTIMATE plans. The permission gate exists in the code but **no feature is currently implemented behind it** — it is a reserved/placeholder benefit.

---

## 16. What's NOT Built (CRM Gaps)

| Feature | Status | Suggested Solution |
|---|---|---|
| CRM / contact management | Not built | HubSpot or Brevo (both have free tiers) |
| Lead pipeline / deals | Not built | HubSpot |
| Drip email sequences | Not built | Set up sequences in Beehiiv or Listmonk directly |
| Community / forum | Placeholder only — no feature | Build custom or use Circle/Discord |
| In-app support chat | Not built | Crisp, Intercom, or Tawk.to |
| Per-client onboarding sequences | Not built | Beehiiv automation or custom |
