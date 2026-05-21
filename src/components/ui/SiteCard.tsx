'use client'
import Link from 'next/link'

function inr(n: number) {
  if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n/100000).toFixed(1)}L`
  if (n >= 1000)     return `₹${(n/1000).toFixed(0)}K`
  return `₹${n.toFixed(0)}`
}

const STATUS: Record<string,string> = {
  ACTIVE:'badge-green', PAUSED:'badge-yellow',
  COMPLETED:'badge-blue', CANCELLED:'badge-gray', PLANNING:'badge-gray',
}

export function SiteCard({ site }: { site: any }) {
  const budget = site.budget ?? 0
  const spent  = site.spent  ?? 0
  const pct    = budget > 0 ? Math.min(100, Math.round((spent/budget)*100)) : 0
  const bar    = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <Link href={`/sites/${site.id}`} className="card p-4 block hover:border-orange-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 truncate text-sm">{site.name}</h3>
          <p className="text-slate-700 text-xs mt-0.5 truncate">{site.location}</p>
        </div>
        <span className={`badge flex-shrink-0 ${STATUS[site.status] ?? 'badge-gray'}`}>{site.status}</span>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>Budget Used</span><span className="font-medium text-slate-800">{pct}%</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${bar}`} style={{width:`${pct}%`}} />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>{inr(spent)} spent</span>
          <span>{inr(budget)} total</span>
        </div>
      </div>
      {(site.labourCount ?? 0) > 0 && (
        <div className="text-xs text-slate-600 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-medium text-slate-700">{site.labourCount} workers</span>
        </div>
      )}
    </Link>
  )
}
