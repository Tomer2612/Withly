# Withly

A community platform for creating and managing online communities with events, posts, courses, and member management.

## Tech Stack

- **Runtime:** Node.js 22 or newer (both `package.json` files require it)
- **Backend:** NestJS 11, Prisma 7 (Postgres driver adapter), PostgreSQL (AWS RDS in production), TypeScript 6
- **Frontend:** Next.js 16 (Turbopack), React 19, Tailwind CSS 4
- **Auth:** JWT in httpOnly cookies, Google OAuth
- **Payments:** HYP (card tokens + recurring charges)
- **Realtime:** Socket.IO (chat, live notifications)
- **Email:** Resend
- **Storage:** Local disk in dev, Cloudflare R2 in production

## Setup

### 1. Install dependencies

```bash
npm ci
cd frontend && npm ci
```

`npm ci` installs exactly what the lockfiles say. After pulling changes that
touched `package.json`, run it again in both folders.

### 2. Configure environment

Create `.env` in the root with at least:

```
DATABASE_URL=postgresql://...
JWT_SECRET=<random string, required — app refuses to start without it>
RESEND_API_KEY=...
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/redirect
# HYP payments (pay terminal + token terminal)
HYP_MASOF=...
HYP_PASSP=...
HYP_KEY=...
HYP_MASOF_TOKEN=...
HYP_PASSP_TOKEN=...
# Production-only
NODE_ENV=production
REFRESH_COOKIE_PATH=/api/auth   # the API is served under /api on prod
R2_BUCKET=...
R2_ENDPOINT=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_CDN_URL=...
```

The backend loads `.env` first thing on startup (`src/main.ts`); the Prisma
CLI reads `DATABASE_URL` through `prisma.config.ts`.

Frontend uses `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Generate Prisma client

```bash
npx prisma generate
```

### 4. Run migrations

```bash
npx prisma migrate dev
```

### 5. Start the dev servers

```bash
# Backend (port 4000)
npm run start:dev

# Frontend (port 3000) — separate terminal
cd frontend && npm run dev
```

## Project Structure

```
├── src/                        # NestJS backend
│   ├── auth/                   # JWT auth + Google OAuth
│   ├── users/                  # User profiles, follows, payment methods
│   ├── communities/            # Community CRUD, membership, bans
│   ├── posts/                  # Posts, comments, likes, polls
│   ├── courses/                # Courses, chapters, lessons, quizzes
│   ├── events/                 # Events, RSVPs, reminders
│   ├── messages/               # Direct messages + Socket.IO gateway
│   ├── notifications/          # In-app notifications
│   ├── email/                  # Email templates + delivery
│   └── common/                 # Shared infra (Prisma, storage, JWT helpers, CORS)
├── prisma/                     # Schema + migrations (CLI config: prisma.config.ts)
├── scripts/                    # Server scripts: plan seed, payout report / mark-paid
├── test/                       # Backend tests (npm test)
├── frontend/                   # Next.js App Router app (route guard: frontend/proxy.ts)
└── uploads/                    # Locally-stored uploads (dev only)
```

## Checks

```bash
npm test             # backend build + tests
npm run lint         # backend lint
npx knip             # unused files / exports / dependencies (both apps)
cd frontend && npm run lint && npm run build
```
