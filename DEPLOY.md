# Trelexa.ai — VPS Deployment Guide

## Architecture

```
Internet (HTTPS :443)
    └── Caddy (reverse proxy, auto-TLS)
            └── Docker Compose (port 4007)
                    └── Nginx :5000 (inside container)
                            ├── /api/* → NestJS :3000
                            └── /*    → Next.js :4200
                    ├── PostgreSQL :5432
                    ├── Redis :6379
                    └── Temporal :7233
```

## Prerequisites on the VPS

1. **Docker + Docker Compose v2**
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. **Caddy** (auto-HTTPS reverse proxy)
   ```bash
   apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
   apt update && apt install caddy
   ```

3. **DNS**: Point your domain `trelexa.ai` (or `app.trelexa.ai`) A record → VPS IP

---

## Step 1 — Clone and Configure

```bash
git clone https://github.com/your-org/postiz-app /opt/trelexa
cd /opt/trelexa
cp .env.example .env
```

Edit `.env` with the values below.

---

## Step 2 — Production `.env`

```env
# ── Core URLs ──────────────────────────────────────────────────────────────
MAIN_URL=https://trelexa.ai
FRONTEND_URL=https://trelexa.ai
NEXT_PUBLIC_BACKEND_URL=https://trelexa.ai/api
BACKEND_INTERNAL_URL=http://localhost:3000

# ── Security ───────────────────────────────────────────────────────────────
# Generate with: openssl rand -hex 64
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_STRING

# ── Database (matches docker-compose.yaml service names) ───────────────────
DATABASE_URL=postgresql://postiz-user:postiz-password@postiz-postgres:5432/postiz-db-local

# ── Redis ──────────────────────────────────────────────────────────────────
REDIS_URL=redis://postiz-redis:6379

# ── Temporal ───────────────────────────────────────────────────────────────
TEMPORAL_ADDRESS=temporal:7233

# ── App mode ───────────────────────────────────────────────────────────────
IS_GENERAL=true

# ── File storage (local) ───────────────────────────────────────────────────
STORAGE_PROVIDER=local
UPLOAD_DIRECTORY=/uploads
NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY=/uploads

# ── Email (optional but recommended) ──────────────────────────────────────
# RESEND_API_KEY=re_xxxxxxxxxxxx
# EMAIL_FROM_ADDRESS=hello@trelexa.ai
# EMAIL_FROM_NAME=Trelexa.ai

# ── Social OAuth (add as needed) ───────────────────────────────────────────
# X_API_KEY=
# X_API_SECRET=
# LINKEDIN_CLIENT_ID=
# LINKEDIN_CLIENT_SECRET=
# REDDIT_CLIENT_ID=
# REDDIT_CLIENT_SECRET=
# FACEBOOK_APP_ID=
# FACEBOOK_APP_SECRET=
# YOUTUBE_CLIENT_ID=
# YOUTUBE_CLIENT_SECRET=
# TIKTOK_CLIENT_ID=
# TIKTOK_CLIENT_SECRET=
# DISCORD_CLIENT_ID=
# DISCORD_CLIENT_SECRET=
# DISCORD_BOT_TOKEN_ID=
```

---

## Step 3 — Start the Stack

```bash
cd /opt/trelexa
docker compose up -d
```

This starts: app (port 4007), PostgreSQL, Redis, Temporal, and supporting services.

Check logs:
```bash
docker compose logs -f postiz
```

---

## Step 4 — Configure Caddy (HTTPS)

Create `/etc/caddy/Caddyfile`:

```
trelexa.ai {
    reverse_proxy localhost:4007
}
```

Reload Caddy:
```bash
systemctl reload caddy
```

Caddy automatically obtains and renews a Let's Encrypt TLS certificate.

---

## Step 5 — Verify

- Open https://trelexa.ai in your browser
- Register the first admin account
- Connect your social media channels

---

## Updating

```bash
cd /opt/trelexa
docker compose pull
docker compose up -d
```

---

## Useful Commands

| Command | Purpose |
|---|---|
| `docker compose ps` | Check running containers |
| `docker compose logs postiz` | App logs |
| `docker compose down` | Stop all services |
| `docker compose exec postiz-postgres psql -U postiz-user postiz-db-local` | Access database |

---

## Storage: Switch to Cloudflare R2 (recommended for production)

Replace the storage section in `.env`:

```env
STORAGE_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_ACCESS_KEY=your_access_key
CLOUDFLARE_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_BUCKETNAME=trelexa-uploads
CLOUDFLARE_BUCKET_URL=https://your-bucket.r2.dev
CLOUDFLARE_REGION=auto
```
