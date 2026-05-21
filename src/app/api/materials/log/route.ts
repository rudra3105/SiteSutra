export const dynamic = "force-dynamic"

import { NextResponse, NextRequest } from 'next/server'
import { logMaterial } from '@/actions/materials'

export async function POST(req: NextRequest) {
  const data = await req.json()
  const result = await logMaterial(data)
  return NextResponse.json(result)
}
