// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { getCashbooks, getParties, getCustomPaymentMethods, ensureAdminBook } from '@/actions/cashbook'
import { getSiteById } from '@/actions/sites'
import { CashbookView } from '@/components/charts/CashbookView'

export default async function SiteAccountingPage({ params }) {
  const session = await getSession()
  if (session?.role !== 'ADMIN' && session?.role !== 'SUPERVISOR') redirect(`/sites/${params.siteId}`)
  const isAdmin = session.role === 'ADMIN'
  if (isAdmin) await ensureAdminBook(params.siteId)

  const [books, customPaymentMethods, site] = await Promise.all([
    getCashbooks(params.siteId),
    getCustomPaymentMethods(params.siteId),
    getSiteById(params.siteId),
  ])
  const parties = books[0] ? await getParties(books[0].id) : []
  // Supervisors only get here for books an admin shared with them (getCashbooks filters)
  if (!isAdmin && books.length === 0) redirect(`/sites/${params.siteId}`)

  return (
    <div className="flex flex-col h-full -m-4 lg:-m-6">
      <CashbookView
        siteId={params.siteId}
        siteName={site?.name ?? ''}
        initialBooks={books}
        initialParties={parties}
        initialCustomPaymentMethods={customPaymentMethods}
        canManage={isAdmin}
      />
    </div>
  )
}
