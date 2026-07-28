#!/usr/bin/env node
// SiteSutra — Local Dev Setup
// Replaces "npm run db:push && npm run db:seed"
// Just run: node scripts/seed-local.js

const bcrypt = require('bcryptjs')
const { createClient } = require('@libsql/client')

const DB_PATH = process.env.DATABASE_URL || 'file:./dev.db'
const db = createClient({ url: DB_PATH })

async function run() {
  console.log('🔧 Setting up SiteSutra local database...')
  console.log('   DB:', DB_PATH)

  // ── Create all tables ───────────────────────────────────────
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'SUPERVISOR',
      phone TEXT, is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT NOT NULL,
      description TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE',
      start_date TEXT NOT NULL, end_date TEXT, budget REAL NOT NULL DEFAULT 0,
      created_by_id TEXT NOT NULL, created_at TEXT, updated_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS site_access (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, site_id TEXT NOT NULL,
      UNIQUE(user_id, site_id))`,

    `CREATE TABLE IF NOT EXISTS work_types (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, name TEXT NOT NULL,
      unit TEXT NOT NULL, created_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS work_logs (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, user_id TEXT NOT NULL,
      work_type_id TEXT NOT NULL, description TEXT, quantity REAL NOT NULL,
      unit TEXT NOT NULL, date TEXT NOT NULL, synced INTEGER DEFAULT 1,
      offline_id TEXT UNIQUE, created_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, name TEXT NOT NULL,
      unit TEXT NOT NULL, created_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS material_logs (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, material_id TEXT NOT NULL,
      type TEXT NOT NULL, quantity REAL NOT NULL, unit_price REAL,
      notes TEXT, date TEXT, synced INTEGER DEFAULT 1,
      offline_id TEXT UNIQUE, created_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS ideal_rules (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, work_type_id TEXT NOT NULL,
      material_id TEXT NOT NULL, ideal_qty_per REAL NOT NULL,
      description TEXT, created_at TEXT, updated_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS labour (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, name TEXT NOT NULL,
      phone TEXT, trade TEXT NOT NULL, daily_wage REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE', join_date TEXT,
      created_at TEXT, updated_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, labour_id TEXT NOT NULL,
      user_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL,
      half_day INTEGER DEFAULT 0, overtime REAL, notes TEXT,
      synced INTEGER DEFAULT 1, offline_id TEXT UNIQUE, created_at TEXT,
      UNIQUE(labour_id, date))`,

    `CREATE TABLE IF NOT EXISTS payroll (
      id TEXT PRIMARY KEY, labour_id TEXT NOT NULL, period_start TEXT NOT NULL,
      period_end TEXT NOT NULL, total_days REAL NOT NULL, daily_wage REAL NOT NULL,
      overtime REAL DEFAULT 0, deductions REAL DEFAULT 0,
      net_amount REAL NOT NULL, status TEXT DEFAULT 'PENDING',
      paid_at TEXT, payment_mode TEXT, notes TEXT, created_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS accounting (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, type TEXT NOT NULL,
      category TEXT NOT NULL, amount REAL NOT NULL, description TEXT NOT NULL,
      payment_mode TEXT NOT NULL, reference TEXT, date TEXT,
      invoice_no TEXT, lpo_id TEXT, created_at TEXT, updated_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS lpos (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, lpo_number TEXT NOT NULL UNIQUE,
      vendor TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL,
      status TEXT DEFAULT 'PENDING', issue_date TEXT, due_date TEXT, created_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS cashbooks (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT, is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS cashbook_entries (
      id TEXT PRIMARY KEY, cashbook_id TEXT NOT NULL, site_id TEXT NOT NULL,
      type TEXT NOT NULL, category TEXT, amount REAL NOT NULL,
      description TEXT, payment_mode TEXT, reference TEXT,
      vendor TEXT, date TEXT NOT NULL, lpo_number TEXT, lpo_status TEXT,
      party_name TEXT, proof_url TEXT, custom_field_values TEXT,
      added_by TEXT, added_by_id TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS parties (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, name TEXT NOT NULL,
      type TEXT, phone TEXT, created_at TEXT DEFAULT (datetime('now')))`,

    `CREATE TABLE IF NOT EXISTS cashbook_custom_fields (
      id TEXT PRIMARY KEY, cashbook_id TEXT NOT NULL, label TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'TEXT', options TEXT,
      required INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')))`,

    `CREATE TABLE IF NOT EXISTS custom_payment_methods (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')))`,

    `CREATE TABLE IF NOT EXISTS cashbook_access (
      id TEXT PRIMARY KEY, cashbook_id TEXT NOT NULL, email TEXT NOT NULL,
      name TEXT NOT NULL, password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')))`,

    `CREATE TABLE IF NOT EXISTS labour_teams (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, name TEXT NOT NULL,
      attendance_method TEXT DEFAULT 'INDIVIDUAL',
      created_at TEXT, updated_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY, team_id TEXT NOT NULL, labour_id TEXT NOT NULL,
      created_at TEXT, UNIQUE(team_id, labour_id))`,

    `CREATE TABLE IF NOT EXISTS site_work_status (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL UNIQUE,
      work_stage TEXT DEFAULT 'FOUNDATION',
      attendance_method TEXT DEFAULT 'INDIVIDUAL', updated_at TEXT)`,

    `CREATE TABLE IF NOT EXISTS site_locations (
      id TEXT PRIMARY KEY, site_id TEXT NOT NULL, location_no TEXT NOT NULL,
      tower_type TEXT NOT NULL, span TEXT, work_stage TEXT DEFAULT 'FOUNDATION',
      notes TEXT,
      excavation_status TEXT, excavation_date TEXT,
      foundation_status TEXT, foundation_date TEXT, foundation_ra TEXT,
      erection_status TEXT, erection_date TEXT, erection_ra TEXT,
      earthing_status TEXT, earthing_date TEXT, earthing_ra TEXT,
      tack_welding_status TEXT, tack_welding_date TEXT, tack_welding_ra TEXT,
      stringing_status TEXT, stringing_date TEXT, stringing_ra TEXT,
      opgw_status TEXT, opgw_date TEXT,
      created_at TEXT, updated_at TEXT)`,
  ]

  for (const sql of tables) {
    await db.execute(sql)
  }

  // Add new columns (safe — ignores if already exists)
  const migrations = [
    'ALTER TABLE cashbook_entries ADD COLUMN added_by TEXT',
    'ALTER TABLE cashbook_entries ADD COLUMN added_by_id TEXT',
    'ALTER TABLE site_locations ADD COLUMN excavation_status TEXT',
    'ALTER TABLE site_locations ADD COLUMN excavation_date TEXT',
    'ALTER TABLE site_locations ADD COLUMN foundation_status TEXT',
    'ALTER TABLE site_locations ADD COLUMN foundation_date TEXT',
    'ALTER TABLE site_locations ADD COLUMN erection_status TEXT',
    'ALTER TABLE site_locations ADD COLUMN erection_date TEXT',
    'ALTER TABLE site_locations ADD COLUMN earthing_status TEXT',
    'ALTER TABLE site_locations ADD COLUMN earthing_date TEXT',
    'ALTER TABLE site_locations ADD COLUMN tack_welding_status TEXT',
    'ALTER TABLE site_locations ADD COLUMN tack_welding_date TEXT',
    'ALTER TABLE site_locations ADD COLUMN stringing_status TEXT',
    'ALTER TABLE site_locations ADD COLUMN stringing_date TEXT',
    'ALTER TABLE site_locations ADD COLUMN opgw_status TEXT',
    'ALTER TABLE site_locations ADD COLUMN opgw_date TEXT',
    'ALTER TABLE site_locations ADD COLUMN foundation_ra TEXT',
    'ALTER TABLE site_locations ADD COLUMN erection_ra TEXT',
    'ALTER TABLE site_locations ADD COLUMN earthing_ra TEXT',
    'ALTER TABLE site_locations ADD COLUMN tack_welding_ra TEXT',
    'ALTER TABLE site_locations ADD COLUMN stringing_ra TEXT',
  ]
  for (const sql of migrations) {
    await db.execute(sql).catch(() => {}) // ignore if column already exists
  }

  console.log('✅ All tables created')

  // ── Seed data ───────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10)
  const supHash   = await bcrypt.hash('super123', 10)
  const now       = new Date().toISOString()
  const today     = now.split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const d2        = new Date(Date.now() - 172800000).toISOString().split('T')[0]

  const inserts = [
    // Users
    { sql: 'INSERT OR IGNORE INTO users (id,email,name,password_hash,role,is_active) VALUES (?,?,?,?,?,?)', args: ['user-admin-001','admin@sitesutra.com','Admin User',adminHash,'ADMIN',1] },
    { sql: 'INSERT OR IGNORE INTO users (id,email,name,password_hash,role,is_active) VALUES (?,?,?,?,?,?)', args: ['user-sup-001','supervisor@sitesutra.com','Site Supervisor',supHash,'SUPERVISOR',1] },

    // Sites
    { sql: 'INSERT OR IGNORE INTO sites (id,name,location,description,status,start_date,end_date,budget,created_by_id) VALUES (?,?,?,?,?,?,?,?,?)', args: ['site-001','Andheri Tower Block A','Andheri West, Mumbai','24-storey residential tower','ACTIVE','2024-01-15','2025-12-31',15000000,'user-admin-001'] },
    { sql: 'INSERT OR IGNORE INTO sites (id,name,location,description,status,start_date,end_date,budget,created_by_id) VALUES (?,?,?,?,?,?,?,?,?)', args: ['site-002','Bandra Villa Complex','Bandra, Mumbai','Luxury villa complex','ACTIVE','2024-03-01','2025-08-31',8500000,'user-admin-001'] },
    { sql: 'INSERT OR IGNORE INTO sites (id,name,location,description,status,start_date,end_date,budget,created_by_id) VALUES (?,?,?,?,?,?,?,?,?)', args: ['site-003','Powai Office Fit-Out','Powai, Mumbai','Grade A office fit-out','PLANNING','2024-06-01','2024-12-31',3200000,'user-admin-001'] },

    // Site access for supervisor
    { sql: 'INSERT OR IGNORE INTO site_access (id,user_id,site_id) VALUES (?,?,?)', args: ['access-001','user-sup-001','site-001'] },
    { sql: 'INSERT OR IGNORE INTO site_access (id,user_id,site_id) VALUES (?,?,?)', args: ['access-002','user-sup-001','site-002'] },

    // Work types
    { sql: 'INSERT OR IGNORE INTO work_types (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['wt-001','site-001','Concrete Pouring','m³'] },
    { sql: 'INSERT OR IGNORE INTO work_types (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['wt-002','site-001','Brickwork','m²'] },
    { sql: 'INSERT OR IGNORE INTO work_types (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['wt-003','site-001','Plastering','m²'] },
    { sql: 'INSERT OR IGNORE INTO work_types (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['wt-004','site-002','Tiling','m²'] },

    // Materials
    { sql: 'INSERT OR IGNORE INTO materials (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['mat-001','site-001','OPC Cement (50kg)','bags'] },
    { sql: 'INSERT OR IGNORE INTO materials (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['mat-002','site-001','River Sand','m³'] },
    { sql: 'INSERT OR IGNORE INTO materials (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['mat-003','site-001','Hollow Block 20cm','pcs'] },
    { sql: 'INSERT OR IGNORE INTO materials (id,site_id,name,unit) VALUES (?,?,?,?)', args: ['mat-004','site-002','Ceramic Tiles 60x60','boxes'] },

    // Ideal rules
    { sql: 'INSERT OR IGNORE INTO ideal_rules (id,site_id,work_type_id,material_id,ideal_qty_per,description) VALUES (?,?,?,?,?,?)', args: ['rule-001','site-001','wt-001','mat-001',6.5,'6.5 bags cement per m³'] },
    { sql: 'INSERT OR IGNORE INTO ideal_rules (id,site_id,work_type_id,material_id,ideal_qty_per,description) VALUES (?,?,?,?,?,?)', args: ['rule-002','site-001','wt-001','mat-002',0.45,'0.45 m³ sand per m³'] },
    { sql: 'INSERT OR IGNORE INTO ideal_rules (id,site_id,work_type_id,material_id,ideal_qty_per,description) VALUES (?,?,?,?,?,?)', args: ['rule-003','site-001','wt-002','mat-003',12.5,'12.5 blocks per m²'] },

    // Labour
    { sql: 'INSERT OR IGNORE INTO labour (id,site_id,name,phone,trade,daily_wage,status,join_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lab-001','site-001','Ramesh Patil','+91 98765 00001','Mason',700,'ACTIVE','2024-01-20'] },
    { sql: 'INSERT OR IGNORE INTO labour (id,site_id,name,phone,trade,daily_wage,status,join_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lab-002','site-001','Suresh Kumar','+91 98765 00002','Helper',500,'ACTIVE','2024-01-20'] },
    { sql: 'INSERT OR IGNORE INTO labour (id,site_id,name,phone,trade,daily_wage,status,join_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lab-003','site-001','Mahesh Yadav','+91 98765 00003','Carpenter',850,'ACTIVE','2024-02-01'] },
    { sql: 'INSERT OR IGNORE INTO labour (id,site_id,name,phone,trade,daily_wage,status,join_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lab-004','site-002','Dinesh Sharma','+91 98765 00004','Tiler',900,'ACTIVE','2024-03-05'] },

    // Work logs
    { sql: 'INSERT OR IGNORE INTO work_logs (id,site_id,user_id,work_type_id,description,quantity,unit,date) VALUES (?,?,?,?,?,?,?,?)', args: ['wl-001','site-001','user-sup-001','wt-001','Level 8 slab pour',45,'m³',today] },
    { sql: 'INSERT OR IGNORE INTO work_logs (id,site_id,user_id,work_type_id,description,quantity,unit,date) VALUES (?,?,?,?,?,?,?,?)', args: ['wl-002','site-001','user-sup-001','wt-002','Block work Level 5',120,'m²',yesterday] },

    // Material logs
    { sql: 'INSERT OR IGNORE INTO material_logs (id,site_id,material_id,type,quantity,unit_price,notes,date) VALUES (?,?,?,?,?,?,?,?)', args: ['ml-001','site-001','mat-001','PURCHASE',500,380,'Supplier delivery',d2] },
    { sql: 'INSERT OR IGNORE INTO material_logs (id,site_id,material_id,type,quantity,unit_price,notes,date) VALUES (?,?,?,?,?,?,?,?)', args: ['ml-002','site-001','mat-001','USAGE',320,null,'Level 8 slab',today] },

    // Attendance
    { sql: 'INSERT OR IGNORE INTO attendance (id,site_id,labour_id,user_id,date,status,half_day) VALUES (?,?,?,?,?,?,?)', args: ['att-001','site-001','lab-001','user-sup-001',today,'PRESENT',0] },
    { sql: 'INSERT OR IGNORE INTO attendance (id,site_id,labour_id,user_id,date,status,half_day) VALUES (?,?,?,?,?,?,?)', args: ['att-002','site-001','lab-002','user-sup-001',today,'PRESENT',0] },
    { sql: 'INSERT OR IGNORE INTO attendance (id,site_id,labour_id,user_id,date,status,half_day) VALUES (?,?,?,?,?,?,?)', args: ['att-003','site-001','lab-003','user-sup-001',today,'ABSENT',0] },

    // Accounting
    { sql: 'INSERT OR IGNORE INTO accounting (id,site_id,type,category,amount,description,payment_mode,date,reference) VALUES (?,?,?,?,?,?,?,?,?)', args: ['acc-001','site-001','INCOME','Client Payment',5000000,'Progress payment 10%','NEFT',d2,'INV-2024-001'] },
    { sql: 'INSERT OR IGNORE INTO accounting (id,site_id,type,category,amount,description,payment_mode,date) VALUES (?,?,?,?,?,?,?,?)', args: ['acc-002','site-001','EXPENSE','Labour',63000,'Labour wages week 1','CASH',yesterday] },

    // Cashbook
    { sql: 'INSERT OR IGNORE INTO cashbooks (id,site_id,name,description) VALUES (?,?,?,?)', args: ['book-001','site-001','Main Account','Primary cashbook for Andheri Tower'] },
    { sql: 'INSERT OR IGNORE INTO cashbooks (id,site_id,name,description) VALUES (?,?,?,?)', args: ['book-002','site-001','Petty Cash','Day-to-day small expenses'] },

    // Cashbook entries
    { sql: 'INSERT OR IGNORE INTO cashbook_entries (id,cashbook_id,site_id,type,category,amount,description,payment_mode,party_name,date) VALUES (?,?,?,?,?,?,?,?,?,?)', args: ['cbe-001','book-001','site-001','OUT','Client Payment',5000000,'Progress payment 10% — Level 8','NEFT','ABC Developers',d2] },
    { sql: 'INSERT OR IGNORE INTO cashbook_entries (id,cashbook_id,site_id,type,category,amount,description,payment_mode,party_name,date) VALUES (?,?,?,?,?,?,?,?,?,?)', args: ['cbe-002','book-001','site-001','IN','Materials',214000,'Cement and sand purchase','Bank Transfer','Shree Cement Suppliers',d2] },
    { sql: 'INSERT OR IGNORE INTO cashbook_entries (id,cashbook_id,site_id,type,category,amount,description,payment_mode,date) VALUES (?,?,?,?,?,?,?,?,?)', args: ['cbe-003','book-001','site-001','IN','Labour',63000,'Labour wages week 1','Cash',yesterday] },
    { sql: 'INSERT OR IGNORE INTO cashbook_entries (id,cashbook_id,site_id,type,category,amount,description,payment_mode,party_name,date) VALUES (?,?,?,?,?,?,?,?,?,?)', args: ['cbe-004','book-001','site-001','OUT','Client Payment',2000000,'Second instalment payment','NEFT','ABC Developers',today] },

    // Parties
    { sql: 'INSERT OR IGNORE INTO parties (id,site_id,name,type,phone) VALUES (?,?,?,?,?)', args: ['party-001','site-001','ABC Developers','Client','+91 98000 11111'] },
    { sql: 'INSERT OR IGNORE INTO parties (id,site_id,name,type,phone) VALUES (?,?,?,?,?)', args: ['party-002','site-001','Shree Cement Suppliers','Supplier','+91 98000 22222'] },
    { sql: 'INSERT OR IGNORE INTO parties (id,site_id,name,type,phone) VALUES (?,?,?,?,?)', args: ['party-003','site-001','Ravi Labour Contractor','Labour Contractor','+91 98000 33333'] },

    // LPOs
    { sql: 'INSERT OR IGNORE INTO lpos (id,site_id,lpo_number,vendor,description,amount,status,issue_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lpo-001','site-001','LPO-2024-001','Shree Cement Suppliers','Cement Sand Aggregate',850000,'APPROVED',d2] },
    { sql: 'INSERT OR IGNORE INTO lpos (id,site_id,lpo_number,vendor,description,amount,status,issue_date) VALUES (?,?,?,?,?,?,?,?)', args: ['lpo-002','site-001','LPO-2024-002','Tata Steel Distributors','Rebar structural',1250000,'PENDING',today] },

    // Site locations
    { sql: 'INSERT OR IGNORE INTO site_locations (id,site_id,location_no,tower_type,span,work_stage) VALUES (?,?,?,?,?,?)', args: ['loc-001','site-001','T-01','Tangent','A-B','ERECTION'] },
    { sql: 'INSERT OR IGNORE INTO site_locations (id,site_id,location_no,tower_type,span,work_stage) VALUES (?,?,?,?,?,?)', args: ['loc-002','site-001','T-02','Angle','B-C','FOUNDATION'] },
    { sql: 'INSERT OR IGNORE INTO site_locations (id,site_id,location_no,tower_type,span,work_stage) VALUES (?,?,?,?,?,?)', args: ['loc-003','site-001','T-03','Dead End','C-D','STRINGING'] },
  ]

  for (const { sql, args } of inserts) {
    await db.execute({ sql, args })
  }

  db.close()

  console.log('')
  console.log('🎉 SiteSutra is ready!')
  console.log('')
  console.log('   Admin:      admin@sitesutra.com     /  admin123')
  console.log('   Supervisor: supervisor@sitesutra.com /  super123')
  console.log('')
  console.log('   Run: npm run dev')
  console.log('   Open: http://localhost:3000')
}

run().catch(e => {
  console.error('')
  console.error('❌ Setup failed:', e.message)
  console.error('')
  process.exit(1)
})
