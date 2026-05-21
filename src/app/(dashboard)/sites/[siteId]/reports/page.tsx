// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getSiteById } from '@/actions/sites'
import { ReportsView } from '@/components/charts/ReportsView'

export default async function SiteReportsPage({ params }) {
  const site = await getSiteById(params.siteId)
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Reports</h2>
        <p className="text-slate-600 text-sm">Export data for this site as CSV or PDF</p>
      </div>
      <ReportsView siteId={params.siteId} siteName={site?.name} />
    </div>
  )
}
