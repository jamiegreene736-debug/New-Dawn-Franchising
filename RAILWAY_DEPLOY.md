# Deploying to Railway

## Prerequisites
- A [Railway](https://railway.app) account
- A PostgreSQL database (Railway provides one as a plugin)

---

## Step 1 — Create a new Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from local directory** (upload the ZIP) or push to a GitHub repo and connect it

---

## Step 2 — Add a PostgreSQL database

In your Railway project:
1. Click **+ New** → **Database** → **PostgreSQL**
2. Railway will automatically inject `DATABASE_URL` into your service

---

## Step 3 — Set environment variables

Go to your service → **Variables** tab and add every variable from `.env.example`.

**Required at minimum:**
| Variable | Notes |
|---|---|
| `DATABASE_URL` | Auto-set by Railway PostgreSQL plugin |
| `ADMIN_EMAIL` | Your admin login email |
| `ADMIN_PASSWORD` | Your admin login password |
| `SESSION_SECRET` | Any long random string (e.g. 64 chars) |
| `ANTHROPIC_API_KEY` | Claude — used by AI agents |
| `APP_BASE_URL` | Set to your Railway public URL after first deploy |

All other variables are optional but enable specific features (SMS, WhatsApp, enrichment, etc.).

---

## Step 4 — Run database migrations

After first deploy, open a Railway shell or run migrations via the CLI:

```bash
npx drizzle-kit push
```

Or set `DATABASE_URL` locally and run it from your machine.

---

## Step 5 — Deploy

Railway will automatically:
1. Run `npm install` to install dependencies
2. Run `npm run build` to build the client + server
3. Start with `npm start` (runs `node dist/index.cjs`)

The app listens on `process.env.PORT` which Railway sets automatically.

---

## Build commands (reference)

| Command | Purpose |
|---|---|
| `npm run build` | Compiles client (Vite) + server (esbuild) into `dist/` |
| `npm start` | Starts the production server |
| `npx drizzle-kit push` | Applies DB schema (run once, after first deploy) |

---

## Notes

- All SMS goes through **Quo (OpenPhone)** — not Twilio
- All WhatsApp goes through **Meta Cloud API** — not Twilio
- The AI agents require `ANTHROPIC_API_KEY`
- Prospect enrichment requires: `SEAMLESS_API_KEY`, `HUNTER_API_KEY`, `PROXYCURL_API_KEY`, `ZEROBOUNCE_API_KEY`, `SERPAPI_KEY`
  - `SEAMLESS_API_KEY` is the primary contact-search + enrichment provider (it replaced Apollo). Create it in the Seamless app under **Settings → Public API → Create New Connection**.
