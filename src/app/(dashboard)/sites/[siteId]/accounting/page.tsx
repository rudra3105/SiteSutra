// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { getCashbooks, getParties, getCustomPaymentMethods } from '@/actions/cashbook'
import { CashbookView } from '@/components/charts/CashbookView'

export default async function SiteAccountingPage({ params }) {
  const session = await getSession()
  if (session?.role !== 'ADMIN') redirect(`/sites/${params.siteId}`)

  const [books, parties, customPaymentMethods] = await Promise.all([
    getCashbooks(params.siteId),
    getParties(params.siteId),
    getCustomPaymentMethods(params.siteId),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Cashbook</h2>
        <p className="text-slate-600 text-sm">Manage income, expenses and LPOs per cashbook</p>
      </div>
      <CashbookView
        siteId={params.siteId}
        initialBooks={books}
        initialParties={parties}
        initialCustomPaymentMethods={customPaymentMethods}
      />
    </div>
  )
}
