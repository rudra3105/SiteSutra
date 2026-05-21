export const dynamic = "force-dynamic"

import { NextResponse, NextRequest } from 'next/server'
import { createWorkLog } from '@/actions/worklogs'

export async function POST(req: NextRequest) {
  const data = await req.json()
  const result = await createWorkLog(data)
  return NextResponse.json(result)
}
