import type { Config } from 'drizzle-kit'

const url = process.env.DATABASE_URL || 'file:./dev.db'
const isPostgres = url.startsWith('postgres')

export default {
  schema:      './src/lib/db/schema.ts',
  out:         './drizzle',
  dialect:     isPostgres ? 'postgresql' : 'sqlite',
  dbCredentials: { url },
} satisfies Config
