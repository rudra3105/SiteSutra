// @ts-nocheck
import * as schema from './schema'

function createDB() {
  const url = process.env.DATABASE_URL || 'file:./prisma/dev.db'

  if (url.startsWith('postgres')) {
    // If it's a neon URL, use neon-http
    if (url.includes('neon.tech')) {
      const { drizzle } = require('drizzle-orm/neon-http')
      const { neon }    = require('@neondatabase/serverless')
      return drizzle(neon(url), { schema })
    }
    
    // Otherwise (Supabase, etc.), use node-postgres
    const { drizzle } = require('drizzle-orm/node-postgres')
    const { Client }  = require('pg')
    const client = new Client({ connectionString: url })
    client.connect()
    return drizzle(client, { schema })
  }

  const { drizzle }      = require('drizzle-orm/libsql')
  const { createClient } = require('@libsql/client')
  return drizzle(createClient({ url }), { schema })
}

const g = globalThis as any
export const db = g._sitesutra_db ?? (g._sitesutra_db = createDB())
export * from './schema'
