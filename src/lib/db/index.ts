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
    console.log('Using standard Postgres driver for:', url.split('@')[1])
    const { drizzle } = require('drizzle-orm/node-postgres')
    const { Client }  = require('pg')
    
    const client = new Client({ 
      connectionString: url,
      ssl: { rejectUnauthorized: false }
    })
    
    // Connect and handle potential error
    client.connect().catch(err => {
      console.error('FAILED TO CONNECT TO POSTGRES:', err.message)
    })
    
    return drizzle(client, { schema })
  }

  const { drizzle }      = require('drizzle-orm/libsql')
  const { createClient } = require('@libsql/client')
  return drizzle(createClient({ url }), { schema })
}

const g = globalThis as any
export const db = g._sitesutra_db ?? (g._sitesutra_db = createDB())
export * from './schema'
