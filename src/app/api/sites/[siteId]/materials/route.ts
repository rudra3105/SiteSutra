export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getMaterialsBySite } from '@/actions/materials'
export async function GET(_: Request, { params }: { params: { siteId: string } }) {
  const mats = await getMaterialsBySite(params.siteId)
  return NextResponse.json({ data: mats })
}
