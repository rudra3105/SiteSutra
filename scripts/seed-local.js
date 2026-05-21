// Pure Node.js - no TypeScript needed
// Run: node scripts/seed-local.js

const bcrypt = require('bcryptjs')
const { createClient } = require('@libsql/client')

const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db'

if (!DATABASE_URL.startsWith('file:')) {
  console.log('This script is for local dev only. Use scripts/migrate.js for production.')
  process.exit(0)
}

const db = createClient({ url: DATABASE_URL })

const now = new Date().toISOString()
const d2  = new Date(Date.now() - 172800000).toISOString().split('T')[0]
const yes = new Date(Date.now() - 86400000).toISOString().split('T')[0]
const tod = new Date().toISOString().split('T')[0]

async function createTables() {
  const sqls = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'SUPERVISOR', phone TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE', start_date TEXT NOT NULL, end_date TEXT, budget REAL NOT NULL DEFAULT 0, created_by_id TEXT NOT NULL, created_at TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS site_access (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, site_id TEXT NOT NULL, UNIQUE(user_id, site_id))`,
    `CREATE TABLE IF NOT EXISTS work_types (id TEXT PRIMARY KEY, site_id TEXT NOT NULL, name TEXT NOT NULL, unit TEXT NOT NULL, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS work_logs (id TEXT PRIMARY KEY, site_id TEXT NOT NULL, user_id TEXT NOT NULL, work_type_id TEXT NOT NULL, description TEXT, quantity REAL NOT NULL, unit TEXT NOT NULL, date TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 1, offline_id TEXT UNIQUE, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, site_id TEXT NOT NULL, name TEXT NOT NULL, unit TEXT NOT NULL, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS material_logs (id TEXT PRIMARY KEY, site_id TEXT NOT NULL, material_id TEXT NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL, unit_price REAL, notes TEXT, date TEXT, synced INTEGER NOT NULL DEFAULT 1, offline_id TEXT UNIQUE, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS ideal_rules (id TEXT PRIMARY KEY, site_id TEXT NOT NULL, work_type_id TEXT NOT NULL, material_id TEXT NOT NULL, ideal_qty_per REAL NOT NULL, description TEXT, created_at TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS labour (id TEXT PRIMARY KEY, site_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, trade TEXT NOT NULL, daily_wage REAL NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', join_date TEXT, created_at TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY, site_id TEXT NOT NULL, labour_id TEXT NOT NULL, user_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, half_day INTEGER NOT NULL DEFAULT 0, overtime REAL, notes TEXT, synced INTEGER NOT NULL DEFAULT 1, offline_id TEXT UNIQUE, created_at TEXT, UNIQUE(labour_id, date))`,
    `CREATE TABLE IF NOT EXISTS payroll (id TEXT PRIMARY KEY, labour_id TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, total_days REAL NOT NULL, daily_wage REAL NOT NULL, overtime REAL NOT NULL DEFAULT 0, deductions REAL NOT NULL DEFAULT 0, net_amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', paid_at TEXT, payment_mode TEXT, notes TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS accounting (id TEXT PRIMARY KEY, site_id TEXT NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, description TEXT NOT NULL, payment_mode TEXT NOT NULL, reference TEXT, date TEXT, invoice_no TEXT, lpo_id TEXT, created_at TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS lpos (id TEXT PRIMARY KEY, site_id TEXT NOT NULL, lpo_number TEXT NOT NULL UNIQUE, vendor TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', issue_date TEXT, due_date TEXT, created_at TEXT)`,
  ]
  for (const sql of sqls) await db.execute(sql)
  console.log('✅ Tables ready')
}

async function seed() {
  const ah = await bcrypt.hash('admin123', 10)
  const sh = await bcrypt.hash('super123', 10)

  await db.execute({ sql: 'INSERT OR IGNORE INTO users (id,email,name,password_hash,role,is_active) VALUES (?,?,?,?,?,?)', args: ['user-admin-001', 'admin@sitesutra.com', 'Admin User', ah, 'ADMIN', 1] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO users (id,email,name,password_hash,role,is_active) VALUES (?,?,?,?,?,?)', args: ['user-sup-001', 'supervisor@sitesutra.com', 'Site Supervisor', sh, 'SUPERVISOR', 1] })
  console.log('✅ Users')

  await db.execute({ sql: 'INSERT OR IGNORE INTO sites (id,name,location,description,status,start_date,end_date,budget,created_by_id) VALUES (?,?,?,?,?,?,?,?,?)', args: ['site-001', 'Andheri Tower Block A', 'Andheri West, Mumbai', '24-storey residential tower', 'ACTIVE', '2024-01-15', '2025-12-31', 15000000, 'user-admin-001'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO sites (id,name,location,description,status,start_date,end_date,budget,created_by_id) VALUES (?,?,?,?,?,?,?,?,?)', args: ['site-002', 'Bandra Villa Complex', 'Bandra, Mumbai', 'Luxury villa complex 12 units', 'ACTIVE', '2024-03-01', '2025-08-31', 8500000, 'user-admin-001'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO sites (id,name,location,description,status,start_date,end_date,budget,created_by_id) VALUES (?,?,?,?,?,?,?,?,?)', args: ['site-003', 'Powai Office Fit-Out', 'Powai, Mumbai', 'Grade A office fit-out', 'PLANNING', '2024-06-01', '2024-12-31', 3200000, 'user-admin-001'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO site_access (id,user_id,site_id) VALUES (?,?,?)', args: ['access-001', 'user-sup-001', 'site-001'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO site_access (id,user_id,site_id) VALUES (?,?,?)', args: ['access-002', 'user-sup-001', 'site-002'] })
  console.log('✅ Sites')

  await db.execute({ sql: 'INSERT OR IGNORE INTO work_types (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['wt-001', 'site-001', 'Concrete Pouring', 'm³'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO work_types (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['wt-002', 'site-001', 'Brickwork', 'm²'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO work_types (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['wt-003', 'site-001', 'Plastering', 'm²'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO work_types (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['wt-004', 'site-002', 'Tiling', 'm²'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO materials (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['mat-001', 'site-001', 'OPC Cement (50kg)', 'bags'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO materials (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['mat-002', 'site-001', 'River Sand', 'm³'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO materials (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['mat-003', 'site-001', 'Hollow Block 20cm', 'pcs'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO materials (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['mat-004', 'site-002', 'Ceramic Tiles 60x60', 'boxes'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO ideal_rules (id,site_id,work_type_id,material_id,ideal_qty_per,description) VALUES (?,?,?,?,?,?)', args: ['rule-001', 'site-001', 'wt-001', 'mat-001', 6.5, '6.5 bags cement per m³'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO ideal_rules (id,site_id,work_type_id,material_id,ideal_qty_per,description) VALUES (?,?,?,?,?,?)', args: ['rule-002', 'site-001', 'wt-001', 'mat-002', 0.45, '0.45 m³ sand per m³'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO ideal_rules (id,site_id,work_type_id,material_id,ideal_qty_per,description) VALUES (?,?,?,?,?,?)', args: ['rule-003', 'site-001', 'wt-002', 'mat-003', 12.5, '12.5 blocks per m²'] })
  console.log('✅ Work types, materials & rules')

  await db.execute({ sql: 'INSERT OR IGNORE INTO labour (id,site_id,name,phone,trade,daily_wage,status,join_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lab-001', 'site-001', 'Ramesh Patil', '+91 98765 00001', 'Mason', 700, 'ACTIVE', '2024-01-20'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO labour (id,site_id,name,phone,trade,daily_wage,status,join_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lab-002', 'site-001', 'Suresh Kumar', '+91 98765 00002', 'Helper', 500, 'ACTIVE', '2024-01-20'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO labour (id,site_id,name,phone,trade,daily_wage,status,join_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lab-003', 'site-001', 'Mahesh Yadav', '+91 98765 00003', 'Carpenter', 850, 'ACTIVE', '2024-02-01'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO labour (id,site_id,name,phone,trade,daily_wage,status,join_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lab-004', 'site-002', 'Dinesh Sharma', '+91 98765 00004', 'Tiler', 900, 'ACTIVE', '2024-03-05'] })
  console.log('✅ Labour')

  await db.execute({ sql: 'INSERT OR IGNORE INTO work_logs (id,site_id,user_id,work_type_id,description,quantity,unit,date) VALUES (?,?,?,?,?,?,?,?)', args: ['wl-001', 'site-001', 'user-sup-001', 'wt-001', 'Level 8 slab pour', 45, 'm³', tod] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO work_logs (id,site_id,user_id,work_type_id,description,quantity,unit,date) VALUES (?,?,?,?,?,?,?,?)', args: ['wl-002', 'site-001', 'user-sup-001', 'wt-002', 'Block work Level 5', 120, 'm²', yes] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO material_logs (id,site_id,material_id,type,quantity,unit_price,notes,date) VALUES (?,?,?,?,?,?,?,?)', args: ['ml-001', 'site-001', 'mat-001', 'PURCHASE', 500, 380, 'Supplier delivery', d2] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO material_logs (id,site_id,material_id,type,quantity,unit_price,notes,date) VALUES (?,?,?,?,?,?,?,?)', args: ['ml-002', 'site-001', 'mat-001', 'USAGE', 320, null, 'Level 8 slab', tod] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO material_logs (id,site_id,material_id,type,quantity,unit_price,notes,date) VALUES (?,?,?,?,?,?,?,?)', args: ['ml-003', 'site-001', 'mat-002', 'PURCHASE', 50, 1800, 'Sand delivery', d2] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO material_logs (id,site_id,material_id,type,quantity,unit_price,notes,date) VALUES (?,?,?,?,?,?,?,?)', args: ['ml-004', 'site-001', 'mat-002', 'USAGE', 22, null, 'Level 8 mix', tod] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO attendance (id,site_id,labour_id,user_id,date,status,half_day) VALUES (?,?,?,?,?,?,?)', args: ['att-001', 'site-001', 'lab-001', 'user-sup-001', tod, 'PRESENT', 0] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO attendance (id,site_id,labour_id,user_id,date,status,half_day) VALUES (?,?,?,?,?,?,?)', args: ['att-002', 'site-001', 'lab-002', 'user-sup-001', tod, 'PRESENT', 0] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO attendance (id,site_id,labour_id,user_id,date,status,half_day) VALUES (?,?,?,?,?,?,?)', args: ['att-003', 'site-001', 'lab-003', 'user-sup-001', tod, 'ABSENT', 0] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO accounting (id,site_id,type,category,amount,description,payment_mode,date,reference) VALUES (?,?,?,?,?,?,?,?,?)', args: ['acc-001', 'site-001', 'INCOME', 'Client Payment', 5000000, 'Progress payment 10%', 'NEFT', d2, 'INV-2024-001'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO accounting (id,site_id,type,category,amount,description,payment_mode,date,reference) VALUES (?,?,?,?,?,?,?,?,?)', args: ['acc-002', 'site-001', 'EXPENSE', 'Materials', 214000, 'Cement and sand purchase', 'BANK_TRANSFER', d2, 'PO-2024-045'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO accounting (id,site_id,type,category,amount,description,payment_mode,date) VALUES (?,?,?,?,?,?,?,?)', args: ['acc-003', 'site-001', 'EXPENSE', 'Labour', 63000, 'Labour wages week 1', 'CASH', yes] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO accounting (id,site_id,type,category,amount,description,payment_mode,date,reference) VALUES (?,?,?,?,?,?,?,?,?)', args: ['acc-004', 'site-002', 'INCOME', 'Client Payment', 2000000, 'Initial advance payment', 'NEFT', d2, 'INV-2024-002'] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO lpos (id,site_id,lpo_number,vendor,description,amount,status,issue_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lpo-001', 'site-001', 'LPO-2024-001', 'Shree Cement Suppliers', 'Cement Sand Aggregate Level 8-12', 850000, 'APPROVED', d2] })
  await db.execute({ sql: 'INSERT OR IGNORE INTO lpos (id,site_id,lpo_number,vendor,description,amount,status,issue_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lpo-002', 'site-001', 'LPO-2024-002', 'Tata Steel Distributors', 'Rebar 10mm 12mm 16mm structural', 1250000, 'PENDING', tod] })
  console.log('✅ Logs, attendance, accounting, LPOs')

  db.close()
  console.log('')
  console.log('🎉 SiteSutra database ready!')
  console.log('   admin@sitesutra.com      /  admin123')
  console.log('   supervisor@sitesutra.com /  super123')
}

createTables()
  .then(seed)
  .catch(e => { console.error('❌ Failed:', e.message); process.exit(1) })
