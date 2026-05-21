'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useOnlineSync } from '@/hooks/useOnlineSync'
import { OfflineBanner } from '@/components/offline/OfflineBanner'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/sites',     label: 'Sites',     icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/settings',  label: 'Settings',  icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', adminOnly: true },
]

function Icon({ d }: { d: string }) {
  // Handle two-path icons (settings)
  const paths = d.split(' M').filter(Boolean)
  if (paths.length > 1) {
    return (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {paths.map((p, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={i === 0 ? p : 'M' + p} />)}
      </svg>
    )
  }
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <div>
        <div className="font-bold text-slate-900 text-sm leading-tight">SiteSutra</div>
        <div className="text-[10px] text-slate-500 leading-tight">Construction ERP</div>
      </div>
    </div>
  )
}

function Footer() {
  return (
    <div className="px-4 py-3 border-t border-slate-200 text-center space-y-0.5">
      <p className="text-[10px] text-slate-500">© {new Date().getFullYear()} SiteSutra. All rights reserved.</p>
      <p className="text-[10px] text-slate-500">
        Developed by{' '}
        <a href="https://www.webriseglobal.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline font-medium">
          Webrise Global
        </a>
      </p>
    </div>
  )
}

export function AppShell({ children, session }: { children: React.ReactNode; session: any }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { pendingCount, isSyncing, syncNow } = useOnlineSync()

  const visibleNav = NAV.filter(n => !n.adminOnly || session?.role === 'ADMIN')
  const bottomNav  = visibleNav.slice(0, 4)

  function NavItem({ item, onClick }: { item: typeof NAV[0]; onClick?: () => void }) {
    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
    return (
      <Link href={item.href} onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          active ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}>
        <Icon d={item.icon} />
        {item.label}
      </Link>
    )
  }

  return (
    <div className="flex h-screen h-dvh overflow-hidden bg-slate-100">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 flex-shrink-0">
        <div className="flex items-center px-5 h-16 border-b border-slate-200">
          <Logo />
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(item => <NavItem key={item.href} item={item} />)}
        </nav>

        {/* Sync + user */}
        {pendingCount > 0 && (
          <button onClick={syncNow} className="mx-3 mb-2 flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors">
            <svg className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isSyncing ? 'Syncing...' : `${pendingCount} pending sync`}
          </button>
        )}

        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center flex-shrink-0">
              <span className="text-orange-700 font-bold text-sm">{session?.name?.[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-sm font-semibold truncate">{session?.name}</p>
              <p className="text-slate-600 text-xs">{session?.role}</p>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-slate-500 hover:text-red-600 transition-colors p-1" title="Logout">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </form>
          </div>
        </div>
        <Footer />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-white flex flex-col h-full z-10 shadow-2xl">
            <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200">
              <Logo />
              <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {visibleNav.map(item => <NavItem key={item.href} item={item} onClick={() => setOpen(false)} />)}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-700 font-bold">{session?.name?.[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 text-sm font-semibold truncate">{session?.name}</p>
                  <p className="text-slate-600 text-xs">{session?.role}</p>
                </div>
              </div>
              <form action="/api/auth/logout" method="POST">
                <button type="submit" className="btn-danger w-full text-sm py-2.5">Logout</button>
              </form>
            </div>
            <Footer />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <OfflineBanner />

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm">
          <button onClick={() => setOpen(true)} className="text-slate-700 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 -ml-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Logo />

          <Link href="/quick-add" className="btn text-xs px-3 py-2 !min-h-[34px]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 pb-24 lg:pb-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex items-stretch justify-around pb-safe z-40 shadow-lg">
          {bottomNav.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 transition-colors min-h-[52px] ${
                  active ? 'text-orange-600' : 'text-slate-600 hover:text-slate-900'
                }`}>
                <div className={`p-1 rounded-lg ${active ? 'bg-orange-50' : ''}`}>
                  <Icon d={item.icon} />
                </div>
                <span className="text-[9px] font-medium leading-tight">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
