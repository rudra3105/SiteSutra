'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  PAUSED: 'bg-amber-500',
  COMPLETED: 'bg-blue-500',
  PLANNING: 'bg-slate-400',
  CANCELLED: 'bg-red-500',
}

function SiteNavLink({
  href,
  label,
  icon,
  onClick,
}: {
  href: string
  label: string
  icon: React.ReactNode
  onClick?: () => void
}) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? 'bg-orange-50 text-orange-700 border border-orange-200'
          : 'text-slate-800 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {icon}
      {label}
    </Link>
  )
}

const navItems = (siteId: string, isAdmin: boolean) => [
  {
    href: `/sites/${siteId}`,
    label: 'Overview',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: `/sites/${siteId}/worklogs`,
    label: 'Work Logs',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: `/sites/${siteId}/labour`,
    label: 'Labour',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: `/sites/${siteId}/materials`,
    label: 'Materials',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  ...(isAdmin
    ? [
        {
          href: `/sites/${siteId}/accounting`,
          label: 'Accounting',
          icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          href: `/sites/${siteId}/reports`,
          label: 'Reports',
          icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ]
    : []),
]

export function SiteShell({
  children,
  site,
  session,
}: {
  children: React.ReactNode
  site: any
  session: any
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isAdmin = session?.role === 'ADMIN'
  const items = navItems(site.id, isAdmin)

  return (
    <div className="flex flex-col h-screen h-dvh overflow-hidden">
      {/* Site header banner */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">All Sites</span>
        </Link>

        <div className="w-px h-5 bg-slate-300 flex-shrink-0" />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_COLOR[site.status] ?? 'bg-slate-400'}`} />
          <h1 className="font-bold text-slate-900 text-sm sm:text-base truncate">{site.name}</h1>
          <span className="text-slate-500 text-xs hidden sm:inline flex-shrink-0">{site.location}</span>
        </div>

        {/* Mobile nav toggle */}
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="lg:hidden text-slate-700 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileNavOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>
      </div>

      {/* Mobile nav dropdown */}
      {mobileNavOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-3 py-2 flex flex-wrap gap-1 shadow-sm">
          {items.map(item => (
            <SiteNavLink key={item.href} {...item} onClick={() => setMobileNavOpen(false)} />
          ))}
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-52 bg-white border-r border-slate-200 flex-shrink-0">
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Site Modules</p>
            {items.map(item => (
              <SiteNavLink key={item.href} {...item} />
            ))}
          </nav>

          {/* Site stats */}
          <div className="p-3 border-t border-slate-200 space-y-1.5">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Site Info</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Status</span>
                  <span className="font-semibold text-slate-900">{site.status}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Budget</span>
                  <span className="font-semibold text-slate-900">
                    ₹{site.budget >= 100000 ? `${(site.budget / 100000).toFixed(1)}L` : site.budget.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Start</span>
                  <span className="font-semibold text-slate-900">{site.startDate}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-100">
          <div className="p-4 lg:p-6 pb-24 lg:pb-0 max-w-[1400px] mx-auto h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom tabs for site nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex items-stretch justify-around z-40 shadow-lg">
        {items.slice(0, 5).map(item => {
          const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 min-h-[52px] transition-colors ${
                active ? 'text-orange-600' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <div className={`p-1 rounded-lg ${active ? 'bg-orange-50' : ''}`}>{item.icon}</div>
              <span className="text-[9px] font-medium leading-tight">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
