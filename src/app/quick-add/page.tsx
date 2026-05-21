import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { getSites } from '@/actions/sites'
import { QuickAddForm } from '@/components/forms/QuickAddForm'

export default async function QuickAddPage({ searchParams }: {
  searchParams: { type?: string; siteId?: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const sites = await getSites()

  return (
    <div className="min-h-screen bg-surface p-4">
      <QuickAddForm
        sites={sites as any}
        defaultType={(searchParams.type as any) || 'worklog'}
        defaultSiteId={searchParams.siteId}
        session={session}
      />
    </div>
  )
}
