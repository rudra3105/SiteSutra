// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getLabourBySite } from '@/actions/labour'
import { getTeams, getSiteWorkStatus } from '@/actions/teams'
import { db, attendance, labour } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { LabourManagementView } from '@/components/charts/LabourManagementView'

export default async function SiteLabourPage({ params }) {
  const { siteId } = params
  const today = new Date().toISOString().split('T')[0]

  const [workers, teams, todayAttendance] = await Promise.all([
    getLabourBySite(siteId),
    getTeams(siteId),
    db.select({ att: attendance, worker: labour })
      .from(attendance)
      .leftJoin(labour, eq(attendance.labourId, labour.id))
      .where(and(eq(attendance.siteId, siteId), sql`date(${attendance.date}) = ${today}`))
  ])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Labour Management</h2>
        <p className="text-slate-600 text-sm">Workers, teams & attendance</p>
      </div>
      <LabourManagementView
        siteId={siteId}
        initialWorkers={workers}
        initialTeams={teams}
        todayAttendance={todayAttendance}
      />
    </div>
  )
}
