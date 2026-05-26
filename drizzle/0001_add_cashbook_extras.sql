-- Additional tables/columns added after initial migration

ALTER TABLE cashbook_entries ADD COLUMN IF NOT EXISTS custom_field_values TEXT;
ALTER TABLE cashbook_entries ADD COLUMN IF NOT EXISTS updated_at TEXT;

CREATE TABLE IF NOT EXISTS cashbook_custom_fields (
  id TEXT PRIMARY KEY,
  cashbook_id TEXT NOT NULL REFERENCES cashbooks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'TEXT',
  options TEXT,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS custom_payment_methods (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS cashbook_access (
  id TEXT PRIMARY KEY,
  cashbook_id TEXT NOT NULL REFERENCES cashbooks(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP::text
);
