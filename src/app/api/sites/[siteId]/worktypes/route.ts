export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db, workTypes } from '@/lib/db'
import { eq } from 'drizzle-orm'
export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  const types = await db.select().from(workTypes).where(eq(workTypes.siteId, params.siteId))
  return NextResponse.json({ data: types })
}
