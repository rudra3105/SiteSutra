export const dynamic = 'force-dynamic'

import { NextResponse, NextRequest } from 'next/server'
import { markAttendance } from '@/actions/labour'
import { requireSession } from '@/lib/auth/session'
import { db, attendance, labour } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const siteId = searchParams.get('siteId')
  const date   = searchParams.get('date') || new Date().toISOString().split('T')[0]

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 })

  const records = await db
    .select({
      id:       attendance.id,
      date:     attendance.date,
      status:   attendance.status,
      halfDay:  attendance.halfDay,
      overtime: attendance.overtime,
      notes:    attendance.notes,
      worker: {
        id:    labour.id,
        name:  labour.name,
        trade: labour.trade,
      },
    })
    .from(attendance)
    .leftJoin(labour, eq(attendance.labourId, labour.id))
    .where(and(eq(attendance.siteId, siteId), sql`date(${attendance.date}) = ${date}`))

  return NextResponse.json({ data: records })
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const result = await markAttendance(data)
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
