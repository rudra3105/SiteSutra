'use client'

import Link from 'next/link'

export function QuickActions({ role }: { role: 'ADMIN' | 'SUPERVISOR' }) {
  return (
    <div className="flex items-center gap-2">
      <Link href="/quick-add" className="btn-primary text-sm flex items-center gap-1.5">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        <span className="hidden sm:inline">Quick Add</span>
        <span className="sm:hidden">Add</span>
      </Link>
    </div>
  )
}
