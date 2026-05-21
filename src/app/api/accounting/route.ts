export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from 'next/server'
import { createAccountingEntry, getAccountingBySite, createLPO, getLPOs } from '@/actions/accounting'
import { requireSession, requireAdmin } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const siteId = searchParams.get('siteId')
  const type = searchParams.get('type') // 'lpo' | null

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 })

  if (type === 'lpo') {
    const lpos = await getLPOs(siteId)
    return NextResponse.json(lpos)
  }

  const entries = await getAccountingBySite(siteId)
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  if (body.type === 'LPO') {
    const lpo = await createLPO(body)
    return NextResponse.json(lpo)
  }

  const entry = await createAccountingEntry(body)
  return NextResponse.json(entry)
}
