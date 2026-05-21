# Deploying SiteSutra to Vercel

## What you need
- Your code on GitHub
- A Vercel account (free) — sign up at vercel.com with GitHub

---

## Step 1 — Run locally first (VS Code terminal)

```bash
npm install
npm run db:push
node scripts/migrate.js
npm run dev
```

Test at http://localhost:3000 — login with admin@sitesutra.com / admin123

---

## Step 2 — Push to GitHub

Make sure your GitHub repo has all the files EXCEPT .env.local
(it's in .gitignore so it won't be committed automatically)

---

## Step 3 — Deploy on Vercel

1. Go to vercel.com → sign in with GitHub
2. Click "Add New Project"
3. Select your SiteSutra repo → click Import
4. Open "Environment Variables" section → add these 2 variables:

   DATABASE_URL   = (get from Vercel Storage — see Step 4)
   JWT_SECRET     = sitesutra-secret-2024-webriseglobal

5. Click Deploy

---

## Step 4 — Create free database on Vercel

After deploying, in your Vercel project:

1. Click "Storage" tab
2. Click "Create Database"
3. Select "Postgres" → click Continue
4. Name it "sitesutra" → click Create
5. Go to "Settings" tab of the database → copy "DATABASE_URL"
6. Go back to your Project → Settings → Environment Variables
7. Update DATABASE_URL with the value you copied
8. Go to Deployments → click the 3 dots → Redeploy

Vercel will rebuild, run the migration script, seed the database, and your app is live.

---

## Login credentials on live site

- Admin:      admin@sitesutra.com  /  admin123
- Supervisor: supervisor@sitesutra.com  /  super123

Change passwords after first login via Settings page.
