-- Migration SQL for Postgres (Supabase)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'SUPERVISOR',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  start_date TEXT NOT NULL,
  end_date TEXT,
  budget DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_by_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS site_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  UNIQUE(user_id, site_id)
);

CREATE TABLE IF NOT EXISTS work_types (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS work_logs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  work_type_id TEXT NOT NULL REFERENCES work_types(id),
  description TEXT,
  quantity DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  date TEXT NOT NULL,
  synced BOOLEAN NOT NULL DEFAULT TRUE,
  offline_id TEXT UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS material_logs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES materials(id),
  type TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  unit_price DOUBLE PRECISION,
  notes TEXT,
  date TEXT NOT NULL,
  synced BOOLEAN NOT NULL DEFAULT TRUE,
  offline_id TEXT UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS ideal_rules (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  work_type_id TEXT NOT NULL REFERENCES work_types(id),
  material_id TEXT NOT NULL REFERENCES materials(id),
  ideal_qty_per DOUBLE PRECISION NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS labour (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  trade TEXT NOT NULL,
  daily_wage DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  join_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  labour_id TEXT NOT NULL REFERENCES labour(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  half_day BOOLEAN NOT NULL DEFAULT FALSE,
  overtime DOUBLE PRECISION,
  notes TEXT,
  synced BOOLEAN NOT NULL DEFAULT TRUE,
  offline_id TEXT UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
  UNIQUE(labour_id, date)
);

CREATE TABLE IF NOT EXISTS payroll (
  id TEXT PRIMARY KEY,
  labour_id TEXT NOT NULL REFERENCES labour(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_days DOUBLE PRECISION NOT NULL,
  daily_wage DOUBLE PRECISION NOT NULL,
  overtime DOUBLE PRECISION NOT NULL DEFAULT 0,
  deductions DOUBLE PRECISION NOT NULL DEFAULT 0,
  net_amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at TEXT,
  payment_mode TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS accounting (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  payment_mode TEXT NOT NULL,
  reference TEXT,
  date TEXT NOT NULL,
  invoice_no TEXT,
  lpo_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS lpos (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  lpo_number TEXT NOT NULL UNIQUE,
  vendor TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  issue_date TEXT NOT NULL,
  due_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS cashbooks (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS cashbook_entries (
  id TEXT PRIMARY KEY,
  cashbook_id TEXT NOT NULL REFERENCES cashbooks(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  payment_mode TEXT NOT NULL,
  reference TEXT,
  vendor TEXT,
  date TEXT NOT NULL,
  lpo_number TEXT,
  lpo_status TEXT,
  party_name TEXT,
  proof_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  phone TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS labour_teams (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  attendance_method TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES labour_teams(id) ON DELETE CASCADE,
  labour_id TEXT NOT NULL REFERENCES labour(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
  UNIQUE(team_id, labour_id)
);

CREATE TABLE IF NOT EXISTS site_locations (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  location_no TEXT NOT NULL,
  tower_type TEXT NOT NULL,
  span TEXT,
  work_stage TEXT NOT NULL DEFAULT 'FOUNDATION',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS site_work_status (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
  work_stage TEXT NOT NULL DEFAULT 'FOUNDATION',
  attendance_method TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);
