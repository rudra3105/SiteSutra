export const dynamic = "force-dynamic"

import { NextResponse, NextRequest } from 'next/server'
import { syncOfflineWorkLogs } from '@/actions/worklogs'
import { syncOfflineAttendance } from '@/actions/labour'
import { syncOfflineMaterials } from '@/actions/materials'

export async function POST(req: NextRequest) {
  const { worklogs = [], attendance = [], materials = [] } = await req.json()

  const [wlResults, attResults, matResults] = await Promise.all([
    worklogs.length > 0 ? syncOfflineWorkLogs(worklogs) : Promise.resolve([]),
    attendance.length > 0 ? syncOfflineAttendance(attendance) : Promise.resolve([]),
    materials.length > 0 ? syncOfflineMaterials(materials) : Promise.resolve([]),
  ])

  return NextResponse.json({
    success: true,
    results: {
      worklogs: wlResults,
      attendance: attResults,
      materials: matResults,
    },
  })
}
