# BuildTrack Pro — Construction Management System

A production-grade Construction Management PWA built with Next.js 14, Drizzle ORM, SQLite (libsql), and Tailwind CSS.

**Zero database setup required — works out of the box.**

---

## 🚀 Quick Start (3 commands)

```bash
# 1. Install dependencies
npm install

# 2. Create database + tables + sample data
npm run db:push && npm run db:seed

# 3. Start the app
npm run dev
```

Open http://localhost:3000

**Login credentials:**
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@buildtrack.com | admin123 |
| Supervisor | supervisor@buildtrack.com | super123 |

That's it. No PostgreSQL, no Neon, no external services needed.

---

## 🗄️ Database

Uses **SQLite via libsql** — a local file at `prisma/dev.db` that creates itself automatically.

- `npm run db:push` — Create/update database schema
- `npm run db:seed` — Add sample data
- `npm run db:studio` — Visual database browser

---

## 📱 PWA Installation

### Android (Chrome)
Tap menu → "Add to Home Screen"

### iOS (Safari)
Share button → "Add to Home Screen"

### Desktop (Chrome/Edge)
Click install icon in address bar

---

## 🏗️ Features

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

## 🌐 Deploy to Vercel (free)

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/you/buildtrack.git
git push -u origin main

# 2. Go to vercel.com → New Project → Import repo
# 3. Add environment variable:
#    DATABASE_URL = file:./prisma/dev.db
#    JWT_SECRET   = (any long random string)
# 4. Deploy
```

> **Note for production:** For Vercel/cloud deployment, switch to [Turso](https://turso.tech) (free tier) by changing DATABASE_URL to `libsql://your-db.turso.io?authToken=...` — no code changes needed.

---

## 🔧 Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Database | SQLite via @libsql/client |
| ORM | Drizzle ORM |
| Auth | Custom JWT (jose + bcryptjs) |
| Styling | Tailwind CSS |
| PWA | next-pwa + service worker |
| Offline | IndexedDB (idb) |

---

## 📋 All npm scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Start production server
npm run db:push      # Apply schema to database
npm run db:seed      # Seed sample data
npm run db:studio    # Drizzle Studio (database GUI)
npm run db:generate  # Generate migration files
```

---

## 🔐 Roles

| Feature | Admin | Supervisor |
|---------|-------|------------|
| All sites | ✅ | Assigned only |
| Work logs | ✅ | ✅ |
| Attendance | ✅ | ✅ |
| Materials | ✅ | ✅ |
| Accounting | ✅ | ❌ |
| Reports | ✅ | ✅ |
| User management | ✅ | ❌ |




