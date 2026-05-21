// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth/session'
import { getMasterDashboard } from '@/actions/accounting'
import { getSites } from '@/actions/sites'
import { MasterDashboardView } from '@/components/charts/MasterDashboardView'
import Link from 'next/link'

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-500', PAUSED: 'bg-amber-500',
  COMPLETED: 'bg-blue-500', PLANNING: 'bg-slate-400', CANCELLED: 'bg-red-500',
}

function inr(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n.toFixed(0)}`
}

export default async function DashboardPage() {
  const session = await getSession()
  const isAdmin = session?.role === 'ADMIN'

  const [dashboard, sites] = await Promise.all([
    isAdmin ? getMasterDashboard() : null,
    getSites(),
  ])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {isAdmin ? 'Master Dashboard' : `Welcome, ${session?.name}`}
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">
            {isAdmin ? 'Select a site to manage it' : 'Select your site to get started'}
          </p>
        </div>
        {isAdmin && (
          <Link href="/sites/new" className="btn text-sm">+ New Site</Link>
        )}
      </div>

      {/* Admin master stats */}
      {isAdmin && dashboard && (
        <MasterDashboardView dashboard={dashboard} />
      )}

      {/* Site selection */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
          {isAdmin ? `All Sites (${sites.length})` : `Your Sites (${sites.length})`}
        </h2>

        {sites.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            </div>
            <p className="text-slate-700 font-semibold mb-1">No sites yet</p>
            <p className="text-slate-500 text-sm mb-4">Create your first construction site to get started</p>
            {isAdmin && <Link href="/sites/new" className="btn inline-flex">Create Site</Link>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sites.map(site => {
              const summary = dashboard?.siteSummaries?.find(s => s.id === site.id)
              const spent = summary?.expense ?? 0
              const pct = site.budget > 0 ? Math.min(100, Math.round((spent / site.budget) * 100)) : 0

              return (
                <Link key={site.id} href={`/sites/${site.id}`}
                  className="card p-5 hover:border-orange-300 hover:shadow-lg transition-all group">

                  {/* Site header */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-orange-100 transition-colors">
                        <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 truncate text-sm leading-tight">{site.name}</h3>
                        <p className="text-slate-500 text-xs mt-0.5 truncate">{site.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${STATUS_DOT[site.status] ?? 'bg-slate-400'}`} />
                      <span className="text-xs font-semibold text-slate-700">{site.status}</span>
                    </div>
                  </div>

                  {/* Budget bar */}
                  {site.budget > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium">Budget Used</span>
                        <span className="text-slate-800 font-bold">{pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>{inr(spent)} spent</span>
                        <span>{inr(site.budget)} total</span>
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3 text-xs text-slate-600">
                      <span>Start: {site.startDate}</span>
                    </div>
                    <span className="text-orange-600 text-xs font-bold group-hover:underline flex items-center gap-1">
                      Open Site
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
