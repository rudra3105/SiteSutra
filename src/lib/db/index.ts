import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

function createPool() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is required (PostgreSQL connection string)')
  }
  const local = url.includes('localhost') || url.includes('127.0.0.1')
  return new Pool({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
  })
}

const g = globalThis as typeof globalThis & { _sitesutra_pool?: Pool }

const pool = g._sitesutra_pool ?? (g._sitesutra_pool = createPool())

export const db = drizzle(pool, { schema })
export * from './schema'
