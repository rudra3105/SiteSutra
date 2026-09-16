// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getWorkLogs } from '@/actions/worklogs'
import { getSiteLocations, getCustomBillingOptions, getCustomStageOptions } from '@/actions/locations'
import { db, workTypes, sites } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { WorkLogsView } from '@/components/charts/WorkLogsView'

export default async function WorkLogsPage({ params }) {
  const { siteId } = params

  const [logs, wts, locations, billingOptions, stageOptions, [site], session] = await Promise.all([
    getWorkLogs(siteId),
    db.select().from(workTypes).where(eq(workTypes.siteId, siteId)),
    getSiteLocations(siteId),
    getCustomBillingOptions(siteId),
    getCustomStageOptions(siteId),
    db.select().from(sites).where(eq(sites.id, siteId)),
    getSession(),
  ])
  const isAdmin = session?.role === 'ADMIN'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Work Logs & Progress</h2>
        <p className="text-slate-600 text-sm">Track locations, work stages, and daily progress</p>
      </div>
      <WorkLogsView
        siteId={siteId}
        siteName={site?.name ?? ''}
        logs={logs}
        workTypes={wts}
        initialLocations={locations}
        initialBillingOptions={billingOptions}
        initialStageOptions={stageOptions}
        isAdmin={isAdmin}
      />
    </div>
  )
}
