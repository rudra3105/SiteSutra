export const dynamic = "force-dynamic"

import { requireSession } from '@/lib/auth/session'
import { getSites } from '@/actions/sites'
import { redirect } from 'next/navigation'
import { AddLabourForm } from '@/components/forms/AddLabourForm'

export default async function NewLabourPage({
  searchParams,
}: {
  searchParams: { siteId?: string }
}) {
  const session = await requireSession()
  if (!session) redirect('/login')

  const sites = await getSites()
  const preselectedSite = searchParams.siteId || ''

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Add New Worker</h1>
        <p className="text-slate-600 text-sm mt-1">Register a worker to a site</p>
      </div>
      <AddLabourForm sites={sites} preselectedSite={preselectedSite} />
    </div>
  )
}
