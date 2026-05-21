'use client'
import { SiteCard } from '@/components/ui/SiteCard'

export function SiteSummaryGrid({ sites }: { sites: any[] }) {
  if (!sites || sites.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-600">
        No sites found. <a href="/sites/new" className="text-orange-400 hover:underline">Create one →</a>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sites.map(site => (
        <SiteCard
          key={site.id}
          site={{
            id:          site.id,
            name:        site.name,
            location:    site.location,
            status:      site.status,
            budget:      site.budget ?? 0,
            spent:       site.expense ?? site.spent ?? 0,
            labourCount: site.labourCount ?? 0,
            income:      site.income ?? 0,
          }}
        />
      ))}
    </div>
  )
}
