// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getWorkLogs } from '@/actions/worklogs'
import { getSiteLocations } from '@/actions/locations'
import { db, workTypes } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { WorkLogsView } from '@/components/charts/WorkLogsView'

export default async function WorkLogsPage({ params }) {
  const { siteId } = params

  const [logs, wts, locations] = await Promise.all([
    getWorkLogs(siteId),
    db.select().from(workTypes).where(eq(workTypes.siteId, siteId)),
    getSiteLocations(siteId),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Work Logs & Progress</h2>
        <p className="text-slate-600 text-sm">Track locations, work stages, and daily progress</p>
      </div>
      <WorkLogsView
        siteId={siteId}
        logs={logs}
        workTypes={wts}
        initialLocations={locations}
      />
    </div>
  )
}
