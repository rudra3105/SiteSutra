export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from 'next/server'
import { getVarianceReport } from '@/actions/materials'
import { requireSession } from '@/lib/auth/session'

export async function GET(
  req: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const report = await getVarianceReport(params.siteId)
  return NextResponse.json(report)
}
