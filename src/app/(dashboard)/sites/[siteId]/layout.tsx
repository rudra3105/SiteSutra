// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getSiteById } from '@/actions/sites'
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

  return (
    <SiteShell site={site} session={session}>
      {children}
    </SiteShell>
  )
}
