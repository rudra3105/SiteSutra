// @ts-nocheck
/* eslint-disable */
// Seed script - runs during Vercel build to create initial data
// Safe to run multiple times (onConflictDoNothing)

const bcrypt = require('bcryptjs')

async function getDB() {
  const url = process.env.DATABASE_URL || 'file:./prisma/dev.db'
  const schema = require('./schema')

  if (url.startsWith('postgres')) {
    const { drizzle } = require('drizzle-orm/neon-http')
    const { neon }    = require('@neondatabase/serverless')
    return { db: drizzle(neon(url), { schema }), schema }
  }

  const { drizzle }      = require('drizzle-orm/libsql')
  const { createClient } = require('@libsql/client')
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
  return { db: drizzle(client, { schema }), schema }
}

async function seed() {
  const { db, schema } = await getDB()
  console.log('🌱 Seeding SiteSutra database...')

  const adminHash = await bcrypt.hash('admin123', 10)
  const supHash   = await bcrypt.hash('super123', 10)

  // Delete and re-insert users to ensure password hashes are always correct
  await db.delete(schema.users).where(require('drizzle-orm').inArray(schema.users.id, ['user-admin-001', 'user-sup-001'])).catch(() => {})
  await db.insert(schema.users).values({ id: 'user-admin-001', email: 'admin@sitesutra.com', name: 'Admin User', passwordHash: adminHash, role: 'ADMIN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).onConflictDoNothing()
  await db.insert(schema.users).values({ id: 'user-sup-001', email: 'supervisor@sitesutra.com', name: 'Site Supervisor', passwordHash: supHash, role: 'SUPERVISOR', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).onConflictDoNothing()
  console.log('✅ Users')

  await db.insert(schema.sites).values([
    { id: 'site-001', name: 'Andheri Tower Block A', location: 'Andheri West, Mumbai', description: '24-storey residential tower', status: 'ACTIVE', budget: 15000000, startDate: '2024-01-15', endDate: '2025-12-31', createdById: 'user-admin-001' },
    { id: 'site-002', name: 'Bandra Villa Complex',  location: 'Bandra, Mumbai', description: 'Luxury villa complex 12 units', status: 'ACTIVE', budget: 8500000, startDate: '2024-03-01', endDate: '2025-08-31', createdById: 'user-admin-001' },
    { id: 'site-003', name: 'Powai Office Fit-Out',  location: 'Powai, Mumbai', description: 'Grade A office fit-out', status: 'PLANNING', budget: 3200000, startDate: '2024-06-01', endDate: '2024-12-31', createdById: 'user-admin-001' },
  ]).onConflictDoNothing()
  console.log('✅ Sites')

  await db.insert(schema.siteAccess).values([
    { id: 'access-001', userId: 'user-sup-001', siteId: 'site-001' },
    { id: 'access-002', userId: 'user-sup-001', siteId: 'site-002' },
  ]).onConflictDoNothing()

  await db.insert(schema.workTypes).values([
    { id: 'wt-001', siteId: 'site-001', name: 'Concrete Pouring', unit: 'm³' },
    { id: 'wt-002', siteId: 'site-001', name: 'Brickwork',        unit: 'm²' },
    { id: 'wt-003', siteId: 'site-001', name: 'Plastering',       unit: 'm²' },
    { id: 'wt-004', siteId: 'site-002', name: 'Tiling',           unit: 'm²' },
  ]).onConflictDoNothing()

  await db.insert(schema.materials).values([
    { id: 'mat-001', siteId: 'site-001', name: 'OPC Cement (50kg)',  unit: 'bags'  },
    { id: 'mat-002', siteId: 'site-001', name: 'River Sand',         unit: 'm³'   },
    { id: 'mat-003', siteId: 'site-001', name: 'Hollow Block 20cm',  unit: 'pcs'  },
    { id: 'mat-004', siteId: 'site-002', name: 'Ceramic Tiles 60x60',unit: 'boxes'},
  ]).onConflictDoNothing()
  console.log('✅ Work types & materials')

  await db.insert(schema.idealRules).values([
    { id: 'rule-001', siteId: 'site-001', workTypeId: 'wt-001', materialId: 'mat-001', idealQtyPer: 6.5,  description: '6.5 bags cement per m³' },
    { id: 'rule-002', siteId: 'site-001', workTypeId: 'wt-001', materialId: 'mat-002', idealQtyPer: 0.45, description: '0.45 m³ sand per m³' },
    { id: 'rule-003', siteId: 'site-001', workTypeId: 'wt-002', materialId: 'mat-003', idealQtyPer: 12.5, description: '12.5 blocks per m²' },
  ]).onConflictDoNothing()

  await db.insert(schema.labour).values([
    { id: 'lab-001', siteId: 'site-001', name: 'Ramesh Patil',  trade: 'Mason',     dailyWage: 700, phone: '+91 98765 00001', joinDate: '2024-01-20' },
    { id: 'lab-002', siteId: 'site-001', name: 'Suresh Kumar',  trade: 'Helper',    dailyWage: 500, phone: '+91 98765 00002', joinDate: '2024-01-20' },
    { id: 'lab-003', siteId: 'site-001', name: 'Mahesh Yadav',  trade: 'Carpenter', dailyWage: 850, phone: '+91 98765 00003', joinDate: '2024-02-01' },
    { id: 'lab-004', siteId: 'site-002', name: 'Dinesh Sharma', trade: 'Tiler',     dailyWage: 900, phone: '+91 98765 00004', joinDate: '2024-03-05' },
  ]).onConflictDoNothing()
  console.log('✅ Labour')

  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const d2        = new Date(Date.now() - 172800000).toISOString().split('T')[0]

  await db.insert(schema.workLogs).values([
    { id: 'wl-001', siteId: 'site-001', workTypeId: 'wt-001', userId: 'user-sup-001', date: today,     quantity: 45,  unit: 'm³', description: 'Level 8 slab pour' },
    { id: 'wl-002', siteId: 'site-001', workTypeId: 'wt-002', userId: 'user-sup-001', date: yesterday, quantity: 120, unit: 'm²', description: 'Block work Level 5' },
    { id: 'wl-003', siteId: 'site-001', workTypeId: 'wt-001', userId: 'user-sup-001', date: d2,        quantity: 38,  unit: 'm³', description: 'Level 7 columns' },
  ]).onConflictDoNothing()

  await db.insert(schema.materialLogs).values([
    { id: 'ml-001', siteId: 'site-001', materialId: 'mat-001', type: 'PURCHASE', quantity: 500, unitPrice: 380,  date: d2,    notes: 'Supplier delivery' },
    { id: 'ml-002', siteId: 'site-001', materialId: 'mat-001', type: 'USAGE',    quantity: 320,               date: today,  notes: 'Level 8 slab' },
    { id: 'ml-003', siteId: 'site-001', materialId: 'mat-002', type: 'PURCHASE', quantity: 50,  unitPrice: 1800, date: d2,   notes: 'Sand delivery' },
    { id: 'ml-004', siteId: 'site-001', materialId: 'mat-002', type: 'USAGE',    quantity: 22,                date: today,  notes: 'Level 8 mix' },
  ]).onConflictDoNothing()

  await db.insert(schema.attendance).values([
    { id: 'att-001', siteId: 'site-001', labourId: 'lab-001', userId: 'user-sup-001', date: today,     status: 'PRESENT' },
    { id: 'att-002', siteId: 'site-001', labourId: 'lab-002', userId: 'user-sup-001', date: today,     status: 'PRESENT' },
    { id: 'att-003', siteId: 'site-001', labourId: 'lab-003', userId: 'user-sup-001', date: today,     status: 'ABSENT'  },
    { id: 'att-004', siteId: 'site-001', labourId: 'lab-001', userId: 'user-sup-001', date: yesterday, status: 'PRESENT' },
    { id: 'att-005', siteId: 'site-001', labourId: 'lab-002', userId: 'user-sup-001', date: yesterday, status: 'PRESENT' },
  ]).onConflictDoNothing()

  await db.insert(schema.accounting).values([
    { id: 'acc-001', siteId: 'site-001', type: 'INCOME',  amount: 5000000, description: 'Progress payment 10%',     category: 'Client Payment', paymentMode: 'NEFT',          date: d2,        reference: 'INV-2024-001' },
    { id: 'acc-002', siteId: 'site-001', type: 'EXPENSE', amount: 214000,  description: 'Cement and sand purchase',  category: 'Materials',       paymentMode: 'BANK_TRANSFER', date: d2,        reference: 'PO-2024-045'  },
    { id: 'acc-003', siteId: 'site-001', type: 'EXPENSE', amount: 63000,   description: 'Labour wages week 1',       category: 'Labour',          paymentMode: 'CASH',          date: yesterday },
    { id: 'acc-004', siteId: 'site-002', type: 'INCOME',  amount: 2000000, description: 'Initial advance payment',   category: 'Client Payment',  paymentMode: 'NEFT',          date: d2,        reference: 'INV-2024-002' },
  ]).onConflictDoNothing()

  await db.insert(schema.lpos).values([
    { id: 'lpo-001', siteId: 'site-001', lpoNumber: 'LPO-2024-001', vendor: 'Shree Cement Suppliers', description: 'Cement Sand Aggregate', amount: 850000,  status: 'APPROVED', issueDate: d2    },
    { id: 'lpo-002', siteId: 'site-001', lpoNumber: 'LPO-2024-002', vendor: 'Tata Steel Distributors', description: 'Rebar structural works', amount: 1250000, status: 'PENDING',  issueDate: today },
  ]).onConflictDoNothing()

  console.log('✅ All data seeded')
  console.log('')
  console.log('🎉 SiteSutra ready!')
  console.log('   admin@sitesutra.com  /  admin123')
  console.log('   supervisor@sitesutra.com  /  super123')
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1) })
