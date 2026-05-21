// @ts-nocheck
export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { getLabourBySite } from '@/actions/labour'
import { cacheWorkers } from '@/lib/offline/db'

export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  const workers = await getLabourBySite(params.siteId)
  const simplified = workers.map(w => ({ id: w.id, name: w.name, trade: w.trade, siteId: w.siteId }))
  return NextResponse.json({ data: simplified })
}
