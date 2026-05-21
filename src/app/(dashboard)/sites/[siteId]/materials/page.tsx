// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getMaterialsBySite, getVarianceReport } from '@/actions/materials'
import { MaterialSiteView } from '@/components/charts/MaterialSiteView'
import Link from 'next/link'

export default async function SiteMaterialsPage({ params }) {
  const { siteId } = params
  const [materials, variance] = await Promise.all([
    getMaterialsBySite(siteId),
    getVarianceReport(siteId),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Materials</h2>
          <p className="text-slate-600 text-sm">{materials.length} materials tracked</p>
        </div>
        <Link href={`/quick-add?type=material&siteId=${siteId}`} className="btn text-sm">+ Log Material</Link>
      </div>
      <MaterialSiteView materials={materials} variance={variance} />
    </div>
  )
}
