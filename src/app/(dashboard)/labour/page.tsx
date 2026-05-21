export const dynamic = "force-dynamic"

import { getSession } from '@/lib/auth/session'
import { getSites } from '@/actions/sites'
import Link from 'next/link'
import { LabourSiteView } from '@/components/charts/LabourSiteView'

export default async function LabourPage() {
  const session = await getSession()
  const sites = await getSites()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Labour Management</h1>
          <p className="text-slate-600 text-sm">Workers, attendance & payroll</p>
        </div>
        <Link href="/quick-add?type=attendance" className="btn-primary text-sm">
          Mark Attendance
        </Link>
      </div>

      {sites.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-600">No sites available. Create a site first.</p>
        </div>
      ) : (
        <LabourSiteView sites={sites as any} />
      )}
    </div>
  )
}
