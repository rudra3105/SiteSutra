// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { getMasterDashboard, getFinancialSummary, getAccountingBySite, getLPOs } from '@/actions/accounting'
import { getSites } from '@/actions/sites'
import { AccountingView } from '@/components/charts/AccountingView'

function inr(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n.toFixed(0)}`
}

export default async function AccountingPage() {
  const session = await getSession()
  if (session?.role !== 'ADMIN') redirect('/dashboard')

  const [dashboard, sites] = await Promise.all([getMasterDashboard(), getSites()])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Accounting</h1>
        <p className="text-slate-600 text-sm">Income, expenses &amp; LPOs across all sites</p>
      </div>

      {/* Master summary */}
      {dashboard && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <div className="text-xs text-slate-600 mb-1">Total Income</div>
            <div className="text-emerald-700 font-bold text-lg">{inr(dashboard.totalIncome)}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xs text-slate-600 mb-1">Total Expenses</div>
            <div className="text-red-700 font-bold text-lg">{inr(dashboard.totalExpense)}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xs text-slate-600 mb-1">Net P&L</div>
            <div className={`font-bold text-lg ${dashboard.netAmount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {dashboard.netAmount >= 0 ? '+' : ''}{inr(dashboard.netAmount)}
            </div>
          </div>
        </div>
      )}

      {/* Per-site breakdown */}
      <div className="space-y-4">
        {sites.map(site => (
          <SiteAccountingSection key={site.id} siteId={site.id} siteName={site.name} />
        ))}
      </div>
    </div>
  )
}

async function SiteAccountingSection({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [financials, entries, lpos] = await Promise.all([
    getFinancialSummary(siteId),
    getAccountingBySite(siteId),
    getLPOs(siteId),
  ])

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900 border-b border-surface-200 pb-2">{siteName}</h2>
      <AccountingView siteId={siteId} financials={financials} entries={entries} lpos={lpos} />
    </div>
  )
}
