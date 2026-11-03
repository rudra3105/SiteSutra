// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getSiteById } from '@/actions/sites'
import { getCashbooks } from '@/actions/cashbook'
import { getSession } from '@/lib/auth/session'
import { notFound, redirect } from 'next/navigation'
import { SiteShell } from '@/components/layout/SiteShell'

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { siteId: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const site = await getSiteById(params.siteId)
  if (!site) notFound()

  const showAccounting = session.role === 'ADMIN' || (await getCashbooks(params.siteId)).length > 0

  return (
    <SiteShell site={site} session={session} showAccounting={showAccounting}>
      {children}
    </SiteShell>
  )
}
