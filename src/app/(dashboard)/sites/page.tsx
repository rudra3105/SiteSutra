// @ts-nocheck
export const dynamic = "force-dynamic"

import { getSites } from '@/actions/sites'
import { getSession } from '@/lib/auth/session'
import Link from 'next/link'
import { SiteCard } from '@/components/ui/SiteCard'

export default async function SitesPage() {
  const session = await getSession()
  const sites = await getSites()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Sites</h1>
          <p className="text-slate-600 text-sm">{sites.length} site{sites.length !== 1 ? 's' : ''}</p>
        </div>
        {session?.role === 'ADMIN' && (
          <Link href="/sites/new" className="btn-primary text-sm">
            + New Site
          </Link>
        )}
      </div>

      {sites.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-16 h-16 text-slate-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
          </svg>
          <p className="text-slate-600 font-medium">No sites yet</p>
          <p className="text-slate-600 text-sm mt-1 mb-4">Create your first construction site</p>
          {session?.role === 'ADMIN' && (
            <Link href="/sites/new" className="btn-primary inline-flex">Create Site</Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sites.map(site => <SiteCard key={site.id} site={site as any} />)}
        </div>
      )}
    </div>
  )
}
