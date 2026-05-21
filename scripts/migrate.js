// Pure Node.js - no TypeScript, no compilation needed
// Runs on every Vercel build: creates tables + seeds data
// Safe to run multiple times (INSERT ... ON CONFLICT DO NOTHING)

const { execSync } = require('child_process')
const path = require('path')
const fs   = require('fs')

// --- Load .env file manually if not already loaded (e.g., in local terminal) ---
if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '../.env')
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8')
    envFile.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=').trim()
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1)
        }
        process.env[key.trim()] = value
      }
    })
  }
}

const DATABASE_URL = process.env.DATABASE_URL

// Skip if no DATABASE_URL (local dev uses SQLite file)
if (!DATABASE_URL) {
  console.log('No DATABASE_URL — skipping migration (local dev)')
  process.exit(0)
}

// Skip for local SQLite file
if (DATABASE_URL.startsWith('file:')) {
  console.log('Local SQLite — skipping auto-migration')
  process.exit(0)
}

console.log('🔧 Running database migration...')

// Use pg (postgres client) which Vercel has available
let pg
try {
  pg = require('pg')
} catch {
  console.log('Installing pg...')
  execSync('npm install pg', { stdio: 'inherit' })
  pg = require('pg')
}

const { Client } = pg

async function run() {
  console.log('🔗 Connecting to:', DATABASE_URL.split('@')[1] || 'DB')
  const client = new Client({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000, // 10 seconds timeout
  })
  
  try {
    await client.connect()
  } catch (connErr) {
    if (connErr.message.includes('ENETUNREACH')) {
      console.error('\n❌ Network Unreachable Error:')
      console.error('This usually means the deployment environment (like Vercel) cannot reach the Supabase IPv6 address.')
      console.error('👉 FIX: Go to Supabase -> Settings -> Database -> Connection Pooler')
      console.error('👉 Use the "Transaction" mode URL (usually port 6543) instead of the direct port 5432.\n')
    }
    throw connErr
  }

  // ── Run SQL migration ──────────────────────────────────────
  console.log('→ Creating tables...')
  const migrationSQL = fs.readFileSync(
    path.join(__dirname, '../drizzle/0000_migration.sql'),
    'utf-8'
  )
  await client.query(migrationSQL)
  console.log('✅ Tables ready')

  // ── Seed data ──────────────────────────────────────────────
  console.log('→ Seeding initial data...')
  const bcrypt = require('bcryptjs')
  const adminHash = await bcrypt.hash('admin123', 10)
  const supHash   = await bcrypt.hash('super123', 10)

  // Users
  await client.query(`
    INSERT INTO users (id, email, name, password_hash, role)
    VALUES
      ('user-admin-001', 'admin@sitesutra.com',      'Admin User',      $1, 'ADMIN'),
      ('user-sup-001',   'supervisor@sitesutra.com', 'Site Supervisor', $2, 'SUPERVISOR')
    ON CONFLICT (id) DO NOTHING
  `, [adminHash, supHash])

  // Sites
  await client.query(`
    INSERT INTO sites (id, name, location, description, status, budget, start_date, end_date, created_by_id)
    VALUES
      ('site-001', 'Andheri Tower Block A', 'Andheri West, Mumbai', '24-storey residential tower', 'ACTIVE',   15000000, '2024-01-15', '2025-12-31', 'user-admin-001'),
      ('site-002', 'Bandra Villa Complex',  'Bandra, Mumbai',       'Luxury villa complex',        'ACTIVE',    8500000, '2024-03-01', '2025-08-31', 'user-admin-001'),
      ('site-003', 'Powai Office Fit-Out',  'Powai, Mumbai',        'Grade A office fit-out',      'PLANNING',  3200000, '2024-06-01', '2024-12-31', 'user-admin-001')
    ON CONFLICT (id) DO NOTHING
  `)

  // Site access
  await client.query(`
    INSERT INTO site_access (id, user_id, site_id) VALUES
      ('access-001', 'user-sup-001', 'site-001'),
      ('access-002', 'user-sup-001', 'site-002')
    ON CONFLICT DO NOTHING
  `)

  // Work types
  await client.query(`
    INSERT INTO work_types (id, site_id, name, unit) VALUES
      ('wt-001', 'site-001', 'Concrete Pouring', 'm³'),
      ('wt-002', 'site-001', 'Brickwork',        'm²'),
      ('wt-003', 'site-001', 'Plastering',       'm²'),
      ('wt-004', 'site-002', 'Tiling',           'm²')
    ON CONFLICT (id) DO NOTHING
  `)

  // Materials
  await client.query(`
    INSERT INTO materials (id, site_id, name, unit) VALUES
      ('mat-001', 'site-001', 'OPC Cement (50kg)',   'bags'),
      ('mat-002', 'site-001', 'River Sand',           'm³'),
      ('mat-003', 'site-001', 'Hollow Block 20cm',   'pcs'),
      ('mat-004', 'site-002', 'Ceramic Tiles 60x60', 'boxes')
    ON CONFLICT (id) DO NOTHING
  `)

  // Ideal rules
  await client.query(`
    INSERT INTO ideal_rules (id, site_id, work_type_id, material_id, ideal_qty_per, description) VALUES
      ('rule-001', 'site-001', 'wt-001', 'mat-001', 6.5,  '6.5 bags cement per m³'),
      ('rule-002', 'site-001', 'wt-001', 'mat-002', 0.45, '0.45 m³ sand per m³'),
      ('rule-003', 'site-001', 'wt-002', 'mat-003', 12.5, '12.5 blocks per m²')
    ON CONFLICT (id) DO NOTHING
  `)

  // Labour
  await client.query(`
    INSERT INTO labour (id, site_id, name, phone, trade, daily_wage, join_date) VALUES
      ('lab-001', 'site-001', 'Ramesh Patil',  '+91 98765 00001', 'Mason',     700, '2024-01-20'),
      ('lab-002', 'site-001', 'Suresh Kumar',  '+91 98765 00002', 'Helper',    500, '2024-01-20'),
      ('lab-003', 'site-001', 'Mahesh Yadav',  '+91 98765 00003', 'Carpenter', 850, '2024-02-01'),
      ('lab-004', 'site-002', 'Dinesh Sharma', '+91 98765 00004', 'Tiler',     900, '2024-03-05')
    ON CONFLICT (id) DO NOTHING
  `)

  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const d2        = new Date(Date.now() - 172800000).toISOString().split('T')[0]

  // Work logs
  await client.query(`
    INSERT INTO work_logs (id, site_id, work_type_id, user_id, date, quantity, unit, description) VALUES
      ('wl-001', 'site-001', 'wt-001', 'user-sup-001', $1, 45,  'm³', 'Level 8 slab pour'),
      ('wl-002', 'site-001', 'wt-002', 'user-sup-001', $2, 120, 'm²', 'Block work Level 5'),
      ('wl-003', 'site-001', 'wt-001', 'user-sup-001', $3, 38,  'm³', 'Level 7 columns')
    ON CONFLICT (id) DO NOTHING
  `, [today, yesterday, d2])

  // Material logs
  await client.query(`
    INSERT INTO material_logs (id, site_id, material_id, type, quantity, unit_price, date, notes) VALUES
      ('ml-001', 'site-001', 'mat-001', 'PURCHASE', 500, 380,  $1, 'Supplier delivery'),
      ('ml-002', 'site-001', 'mat-001', 'USAGE',    320, NULL, $2, 'Level 8 slab'),
      ('ml-003', 'site-001', 'mat-002', 'PURCHASE', 50,  1800, $1, 'Sand delivery'),
      ('ml-004', 'site-001', 'mat-002', 'USAGE',    22,  NULL, $2, 'Level 8 mix')
    ON CONFLICT (id) DO NOTHING
  `, [d2, today])

  // Attendance
  await client.query(`
    INSERT INTO attendance (id, site_id, labour_id, user_id, date, status) VALUES
      ('att-001', 'site-001', 'lab-001', 'user-sup-001', $1, 'PRESENT'),
      ('att-002', 'site-001', 'lab-002', 'user-sup-001', $1, 'PRESENT'),
      ('att-003', 'site-001', 'lab-003', 'user-sup-001', $1, 'ABSENT'),
      ('att-004', 'site-001', 'lab-001', 'user-sup-001', $2, 'PRESENT'),
      ('att-005', 'site-001', 'lab-002', 'user-sup-001', $2, 'PRESENT')
    ON CONFLICT DO NOTHING
  `, [today, yesterday])

  // Accounting
  await client.query(`
    INSERT INTO accounting (id, site_id, type, amount, description, category, payment_mode, date, reference) VALUES
      ('acc-001', 'site-001', 'INCOME',  5000000, 'Progress payment 10%',    'Client Payment', 'NEFT',          $1, 'INV-2024-001'),
      ('acc-002', 'site-001', 'EXPENSE', 214000,  'Cement and sand purchase', 'Materials',      'BANK_TRANSFER', $1, 'PO-2024-045'),
      ('acc-003', 'site-001', 'EXPENSE', 63000,   'Labour wages week 1',      'Labour',         'CASH',          $2, NULL),
      ('acc-004', 'site-002', 'INCOME',  2000000, 'Initial advance payment',  'Client Payment', 'NEFT',          $1, 'INV-2024-002')
    ON CONFLICT (id) DO NOTHING
  `, [d2, yesterday])

  // LPOs
  await client.query(`
    INSERT INTO lpos (id, site_id, lpo_number, vendor, description, amount, status, issue_date) VALUES
      ('lpo-001', 'site-001', 'LPO-2024-001', 'Shree Cement Suppliers', 'Cement Sand Aggregate', 850000,  'APPROVED', $1),
      ('lpo-002', 'site-001', 'LPO-2024-002', 'Tata Steel Distributors', 'Rebar structural works', 1250000, 'PENDING', $2)
    ON CONFLICT DO NOTHING
  `, [d2, today])

  console.log('✅ Data seeded')

  await client.end()

  console.log('')
  console.log('🎉 SiteSutra database ready!')
  console.log('   admin@sitesutra.com     /  admin123')
  console.log('   supervisor@sitesutra.com  /  super123')
}

run().catch(err => {
  console.error('❌ Migration failed:', err.message)
  process.exit(1)
})
