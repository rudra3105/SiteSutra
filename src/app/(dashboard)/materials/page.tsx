// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getSites } from '@/actions/sites'
import { getMaterialsBySite, getVarianceReport } from '@/actions/materials'
import Link from 'next/link'
import { MaterialSiteView } from '@/components/charts/MaterialSiteView'

export default async function MaterialsPage() {
  const sites = await getSites()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Material Management</h1>
          <p className="text-slate-600 text-sm">Stock tracking &amp; ideal vs actual</p>
        </div>
        <Link href="/quick-add?type=material" className="btn text-sm">+ Log Material</Link>
      </div>

      <div className="space-y-6">
        {sites.map(site => (
          <SiteMaterials key={site.id} siteId={site.id} siteName={site.name} />
        ))}
      </div>
    </div>
  )
}

async function SiteMaterials({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [materials, variance] = await Promise.all([
    getMaterialsBySite(siteId),
    getVarianceReport(siteId),
  ])
  if (materials.length === 0) return null
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">{siteName}</h2>
      <MaterialSiteView materials={materials} variance={variance} />
    </div>
  )
}
