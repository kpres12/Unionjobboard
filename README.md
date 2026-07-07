# Haymarket

Labor-aligned job board — union shops, co-ops, nonprofits, public-sector roles, labor organizations, and curated B Corps.

## Architecture

| Layer | Tech | Port | Role |
|-------|------|------|------|
| Frontend | React + Vite + Tailwind | 5173 (dev) / 80 (prod) | UI, search, auth, applications |
| API | Node.js + Express + SQLite | 3001 | REST API, auth, database |
| Search | Python + FastAPI | 8000 | Job search ranking & application scoring |

## Features

- Browse and search labor-aligned job listings (Union, Co-op, Nonprofit, Public Sector, Labor Organization, B-Corp)
- **Auto-seed from real sources** — USFWC, Idealist (nonprofits), USAJobs (public sector), Jobicy, RemoteOK, Arbeitnow
- **B-Corp curation** — user-posted and imported B-Corps enter an admin review queue before going live
- User registration and JWT authentication with **bcrypt password hashing**
- Post and manage job listings
- Application tracking with cover letters and match scoring
- Admin dashboard
- Docker deployment

## Authentication

Passwords are hashed with **bcrypt** (12 rounds) before storage. Plain-text passwords are never saved.

- **Email/password** — register and sign in via the header dialog
- **Forgot password** — `/forgot-password` sends a reset link (logged to server console in dev)
- **Google Sign-In** — server redirect flow; set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in `server/.env`
- **Apple Sign-In** — server redirect flow; set Apple credentials in `server/.env` (see `.env.example`)
- **Roles** — choose Job Seeker, Job Poster, or Both on sign-up
- Password requirements: 8+ characters, at least one letter and one number
- Change password at `/account` (email accounts only)
- Sessions use JWT tokens (7-day expiry)

### Dashboard

Single dashboard at `/dashboard` with role-based views:

| Role | What you see |
|------|----------------|
| Job Seeker | Seeking tab — applications, stats |
| Job Poster | Posting tab — listings, applicants |
| Both | Tabs: **Seeking** \| **Posting** |

### OAuth setup

Social buttons are always visible in the sign-in dialog. Add credentials to `server/.env` to enable them.

**Google** ([Google Cloud Console](https://console.cloud.google.com/apis/credentials)):
1. Create an OAuth 2.0 Client ID (Web application)
2. Authorized redirect URI: `http://localhost:3001/api/auth/oauth/google/callback`
3. Copy Client ID and Secret into `server/.env`

**Apple** ([Apple Developer](https://developer.apple.com/account/resources/identifiers/list/serviceId)):
1. Create a Services ID with Sign in with Apple enabled
2. Return URL: `http://localhost:3001/api/auth/oauth/apple/callback`
3. Create a Sign in with Apple key and add Team ID, Key ID, and private key to `server/.env`

## Job Sources

On `npm run seed` or `npm run sync-jobs`, the Python service fetches listings from:

| Source | Description |
|--------|-------------|
| **USFWC** | U.S. Federation of Worker Cooperatives job board (real co-op listings) |
| **Jobicy** | Remote jobs filtered for union/co-op keywords |
| **RemoteOK** | Remote jobs filtered for union/co-op keywords |
| **Arbeitnow** | Jobs filtered for union/co-op keywords |

Jobs are deduplicated and stored with `source`, `source_url`, and `external_id` for re-sync without duplicates.

### Job source API keys

Copy `python-service/.env.example` to `python-service/.env` and add keys for optional sources:

| Source | Env vars | Notes |
|--------|----------|-------|
| **USAJobs** | `USAJOBS_API_KEY`, `USAJOBS_USER_AGENT` | Free key at [developer.usajobs.gov](https://developer.usajobs.gov/apirequest/). User-Agent must be your registration email. |
| **Idealist** | `IDEALIST_API_KEY` | Nonprofit listings via Idealist Listings API. Contact Idealist for a production key. |

Without keys, Haymarket still syncs from USFWC, Jobicy, RemoteOK, and Arbeitnow.

## Monetization (listing infrastructure)

Haymarket uses employer-paid listings to fund the platform while keeping job seeker access free.

| Plan | Price | Who it's for |
|------|-------|----------------|
| **Community** | Free | Unions, co-ops, nonprofits, public sector, labor orgs — 1 listing per 90 days |
| **Standard** | $149 | Any employer — 60-day listing |
| **Featured** | $228 | Top-of-search placement for 7 days + Standard |

Paid plans use **Stripe Checkout**. Configure in `server/.env`:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_DEV_AUTO_PAY=true   # local dev: skip Stripe, auto-activate paid listings
APP_URL=http://localhost:5173
```

Webhook endpoint: `POST /api/billing/webhook` (register in Stripe dashboard).

### Stripe test mode (local)

```bash
# 1. Install CLI (macOS)
brew install stripe/stripe-cli/stripe

# 2. Guided setup
npm run stripe:setup
npm run stripe:login

# 3. Add sk_test_... to server/.env (from dashboard.stripe.com/test/apikeys)

# 4. Forward webhooks (separate terminal — copy whsec_... into server/.env)
npm run stripe:webhook

# 5. Restart API, then verify
curl http://localhost:3001/api/billing/status

# 6. Post a Standard/Featured job at /post-job
#    Test card: 4242 4242 4242 4242
```

Set `STRIPE_DEV_AUTO_PAY=true` only if you want to skip Stripe entirely during local dev.

### B-Corp review workflow

- User-posted and imported **B-Corp** listings start as `pending`
- They are hidden from public search until an admin approves them in **Admin → B-Corp Queue**
- Admins can approve, reject, or delete queued listings

```bash
npm run sync-jobs   # pull latest listings anytime
```

## Quick Start (Development)

### Prerequisites

- Node.js 18+
- Python 3.12 or 3.13

### Setup

```bash
npm install
npm run install:all

# Python service
cd python-service
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Seed database
npm run seed
```

### Run

```bash
npm run dev
```

Open **http://localhost:5173**

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| User | demo@haymarket.jobs | Demo1234 |
| Admin | admin@haymarket.jobs | Admin1234 |

## Production Deployment (Docker)

```bash
# Copy and edit secrets
cp .env.example .env

# Build and start all services
docker compose up -d --build
```

The app will be available at **http://localhost** (port 80).

Services:
- `web` — React frontend (nginx, proxies `/api` to backend)
- `api` — Node.js API with persistent SQLite volume
- `python` — FastAPI search/scoring service

```bash
# View logs
docker compose logs -f

# Stop
docker compose down
```

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `PUT /api/auth/password` — Change password (auth)

### Jobs
- `GET /api/jobs?q=&location=&type=`
- `GET /api/jobs/:id`
- `POST /api/jobs` (auth)
- `DELETE /api/jobs/:id` (owner)

### Applications
- `POST /api/applications` (auth)
- `GET /api/applications/mine` (auth)
- `GET /api/applications/job/:jobId` (job owner or admin)
- `PATCH /api/applications/:id` (job owner or admin)
- `DELETE /api/applications/:id` (applicant)

### Admin
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/jobs`
- `GET /api/admin/applications`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `PATCH /api/admin/jobs/:id/approval` — approve or reject B-Corp listings

### Python Service
- `POST /search` — Rank jobs by relevance
- `POST /score-application` — Score cover letter against job description
- `GET /health`

## Project Structure

```
├── client/           # React frontend
├── server/           # Node.js Express API
├── python-service/   # FastAPI search microservice
├── docker-compose.yml
└── package.json
```

## License

MIT
