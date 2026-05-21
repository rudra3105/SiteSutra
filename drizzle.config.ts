import type { Config } from 'drizzle-kit'

const url = process.env.DATABASE_URL || 'file:./prisma/dev.db'

export default {
  schema: './src/lib/db/schema.ts',
  out:    './drizzle',
  dialect: url.startsWith('postgres') ? 'postgresql' : 'sqlite',
  dbCredentials: { url },
} satisfies Config
