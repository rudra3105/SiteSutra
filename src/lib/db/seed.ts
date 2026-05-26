// Seed script - uses shared Postgres connection via migrate.js for CLI runs.
// Kept for drizzle-kit / manual imports; prefer: node scripts/migrate.js

import { db } from './index'
import * as schema from './schema'
import { inArray } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function seed() {
  console.log('🌱 Seeding SiteSutra database...')

  const adminHash = await bcrypt.hash('admin123', 10)
  const supHash   = await bcrypt.hash('super123', 10)

  await db.delete(schema.users).where(inArray(schema.users.id, ['user-admin-001', 'user-sup-001'])).catch(() => {})
  await db.insert(schema.users).values({
    id: 'user-admin-001', email: 'admin@sitesutra.com', name: 'Admin User',
    passwordHash: adminHash, role: 'ADMIN',
  }).onConflictDoNothing()
  await db.insert(schema.users).values({
    id: 'user-sup-001', email: 'supervisor@sitesutra.com', name: 'Site Supervisor',
    passwordHash: supHash, role: 'SUPERVISOR',
  }).onConflictDoNothing()

  console.log('✅ Users seeded')
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1) })
