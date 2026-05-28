// @ts-nocheck
import * as schema from './schema'

function createDB() {
  const url = process.env.DATABASE_URL

  if (!url) {
    // Local dev fallback — SQLite
    const { drizzle }      = require('drizzle-orm/libsql')
    const { createClient } = require('@libsql/client')
    const localUrl = 'file:./dev.db'
    return drizzle(createClient({ url: localUrl }), { schema })
  }

  if (url.startsWith('postgres') || url.startsWith('postgresql')) {
    // Production — pure PostgreSQL via pg (NOT Neon, NOT neon-http)
    const { drizzle } = require('drizzle-orm/node-postgres')
    const { Pool }    = require('pg')
    const pool = new Pool({
      connectionString: url,
      ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
    })
    return drizzle(pool, { schema })
  }

  // Local SQLite file
  const { drizzle }      = require('drizzle-orm/libsql')
  const { createClient } = require('@libsql/client')
  return drizzle(createClient({ url }), { schema })
}

const g = globalThis as any
export const db = g._sitesutra_db ?? (g._sitesutra_db = createDB())
export * from './schema'
