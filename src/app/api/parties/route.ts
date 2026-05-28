export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { db, parties } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json([], { status: 401 })
  const { searchParams } = new URL(req.url)
  const siteId     = searchParams.get('siteId')
  const cashbookId = searchParams.get('cashbookId')
  if (!siteId) return NextResponse.json([])

  let result
  if (cashbookId) {
    result = await db.select().from(parties)
      .where(and(eq(parties.siteId, siteId), eq(parties.cashbookId, cashbookId)))
      .orderBy(parties.name)
  } else {
    result = await db.select().from(parties).where(eq(parties.siteId, siteId)).orderBy(parties.name)
  }
  return NextResponse.json(result)
}
