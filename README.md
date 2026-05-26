# SiteSutra — Construction Management System

A production-grade Construction Management PWA built with Next.js 14, Drizzle ORM, PostgreSQL, and Tailwind CSS.

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- A PostgreSQL database ([Supabase](https://supabase.com), [Neon](https://neon.tech), or local Postgres)

### 2. Environment

Copy `.env.example` to `.env` and set:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-long-random-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`DATABASE_URL` must be a PostgreSQL connection string (`postgresql://` or `postgres://`).

### 3. Install, migrate, run

```bash
npm install
npm run db:migrate   # create tables + seed sample data
npm run dev
```

Open http://localhost:3000

**Login credentials (after seed):**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sitesutra.com | admin123 |
| Supervisor | supervisor@sitesutra.com | super123 |

---

## Database

Uses **PostgreSQL** with [Drizzle ORM](https://orm.drizzle.team/) and the `pg` driver.

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Run SQL migrations + seed (idempotent) |
| `npm run db:push` | Push schema directly via drizzle-kit (dev) |
| `npm run db:generate` | Generate new migration SQL from schema |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run setup` | Alias for `db:migrate` |

Migrations live in `drizzle/`:

- `0000_migration.sql` — core tables
- `0001_add_cashbook_extras.sql` — cashbook extensions
- `meta/_journal.json` — Drizzle journal

`npm run build` runs `scripts/migrate.js` before the Next.js build, so Vercel deploys apply migrations automatically when `DATABASE_URL` is set.

---

## PWA Installation

### Android (Chrome)

Tap menu → "Add to Home Screen"

### iOS (Safari)

Share button → "Add to Home Screen"

### Desktop (Chrome/Edge)

Click install icon in the address bar

---

## Features

| Module | What it does |
|--------|-------------|
| **Sites** | Create and manage multiple construction sites |
| **Work Logs** | Track daily work completed by type and quantity |
| **Materials** | Purchases, usage, stock levels |
| **Ideal vs Actual** | Compare planned vs actual material consumption, alerts on >5% variance |
| **Labour** | Worker profiles, daily attendance, wage tracking |
| **Accounting** | Income, expenses, LPOs — admin only |
| **Reports** | CSV download + printable PDF for all modules |
| **Offline PWA** | Add entries without internet, auto-syncs on reconnect |

---

## Deploy to Vercel

```bash
git push origin main
```

In Vercel → Project → Settings → Environment Variables:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://postgres:...@db.xxx.supabase.co:5432/postgres` |
| `JWT_SECRET` | long random string |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

Deploy. The build step runs migrations and seeds demo users (safe to re-run; uses `ON CONFLICT DO NOTHING`).

**Supabase tip:** Use the direct connection string (port `5432`) from Project Settings → Database, not the pooler URL, for migrations.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL (`pg`) |
| ORM | Drizzle ORM |
| Auth | Custom JWT (jose + bcryptjs) |
| Styling | Tailwind CSS |
| PWA | next-pwa + service worker |
| Offline | IndexedDB (idb) |

---

## npm scripts

```bash
npm run dev          # Development server
npm run build        # Migrate DB + production build
npm run start        # Start production server
npm run db:migrate   # Run migrations + seed
npm run db:push      # Push schema (drizzle-kit)
npm run db:generate  # Generate migration files from schema
npm run db:studio    # Drizzle Studio
```

---

## Roles

| Feature | Admin | Supervisor |
|---------|-------|------------|
| All sites | Yes | Assigned only |
| Work logs | Yes | Yes |
| Attendance | Yes | Yes |
| Materials | Yes | Yes |
| Accounting | Yes | No |
| Reports | Yes | Yes |
| User management | Yes | No |
