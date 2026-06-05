'use client'

import Link from 'next/link'
import { useState } from 'react'
import { deleteSite } from '@/actions/sites'
import { useRouter } from 'next/navigation'

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

export function SiteCard({ site, isAdmin }: { site: any; isAdmin?: boolean }) {
  const router  = useRouter()
  const budget  = site.budget ?? 0
  const spent   = site.spent  ?? 0
  const pct     = budget > 0 ? Math.min(100, Math.round((spent/budget)*100)) : 0
  const bar     = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!confirm(`Delete site "${site.name}"? This will delete all data including workers, cashbooks, and entries. This cannot be undone.`)) return
    setDeleting(true)
    await deleteSite(site.id)
    router.refresh()
  }

  return (
    <div className="card p-4 hover:border-orange-300 hover:shadow-md transition-all relative group">
      {/* Admin actions */}
      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Link href={`/sites/${site.id}/edit`}
            onClick={e => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-sm"
            title="Edit site">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Link>
          <button onClick={handleDelete} disabled={deleting}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300 transition-colors shadow-sm disabled:opacity-50"
            title="Delete site">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      <Link href={`/sites/${site.id}`} className="block">
        <div className="flex items-start justify-between gap-2 mb-3 pr-16">
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
    </div>
  )
}
