'use client'

import { useState } from 'react'

interface ReportsViewProps {
  siteId?: string
  siteName?: string
  isAdmin?: boolean
}

const reportTypes = [
  { id: 'site', label: 'Site Overview', icon: '🏗️', description: 'Work logs, attendance, materials, and financials' },
  { id: 'material', label: 'Material Report', icon: '🧱', description: 'Purchases, usage, and stock levels' },
  { id: 'labour', label: 'Labour Report', icon: '👷', description: 'Attendance records and wage calculations' },
  { id: 'financial', label: 'Financial Report', icon: '💰', description: 'Income, expenses, LPOs, and P&L summary' },
]

export function ReportsView({ siteId, siteName }: ReportsViewProps) {
  const [selectedSite, setSelectedSite] = useState(siteId || '')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (type: string, fmt: 'csv' | 'pdf') => {
    const site = selectedSite || siteId
    if (!site) { setError('Please enter a site ID first'); return }

    setLoading(`${type}-${fmt}`)
    setError(null)

    try {
      const params = new URLSearchParams({ siteId: site, type, format: fmt })
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)

      const res = await fetch(`/api/reports?${params}`)
      if (!res.ok) throw new Error(await res.text() || 'Export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const cd = res.headers.get('Content-Disposition') || ''
      const fname = cd.match(/filename="([^"]+)"/)?.[1] || `${type}-report.${fmt === 'csv' ? 'csv' : 'html'}`

      if (fmt === 'pdf') {
        window.open(url, '_blank')
      } else {
        const a = document.createElement('a')
        a.href = url; a.download = fname
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
      }
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setLoading(null)
    }
  }

  const activeSite = selectedSite || siteId

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports & Exports</h1>
        <p className="text-slate-600 mt-1 text-sm">Download site data as CSV or printable PDF</p>
      </div>

      {/* Filter */}
      <div className="card p-4 space-y-4">
        <h2 className="font-semibold text-white">Filter Options</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {siteId ? (
            <div>
              <label className="label">Site</label>
              <div className="input bg-slate-100-2 text-white cursor-default">{siteName || siteId}</div>
            </div>
          ) : (
            <div>
              <label className="label">Site ID</label>
              <input className="input" placeholder="e.g. site-001" value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Or navigate from Sites page</p>
            </div>
          )}
          <div>
            <label className="label">From Date</label>
            <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
        {(!fromDate || !toDate) && (
          <p className="text-xs text-amber-700">📅 No date filter — all records will be included</p>
        )}
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reportTypes.map((report) => (
          <div key={report.id} className="card p-5 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{report.icon}</span>
              <div>
                <h3 className="font-semibold text-white">{report.label}</h3>
                <p className="text-xs text-slate-600 mt-0.5">{report.description}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleExport(report.id, 'csv')}
                disabled={!!loading || !activeSite}
                className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === `${report.id}-csv` ? (
                  <><span className="animate-spin inline-block">⟳</span> Exporting...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> CSV</>
                )}
              </button>
              <button
                onClick={() => handleExport(report.id, 'pdf')}
                disabled={!!loading || !activeSite}
                className="btn flex-1 flex items-center justify-center gap-2 text-sm py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === `${report.id}-pdf` ? (
                  <><span className="animate-spin inline-block">⟳</span> Opening...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> PDF</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="card p-4 border border-red-500/30 bg-red-500/10">
          <p className="text-red-700 text-sm">❌ {error}</p>
        </div>
      )}

      <div className="card p-4 bg-blue-500/10 border border-blue-500/20">
        <h3 className="font-semibold text-blue-300 text-sm mb-2">📄 About PDF Export</h3>
        <p className="text-xs text-slate-600">
          PDF opens in a new tab as a print-ready page. Use <strong className="text-slate-800">Ctrl+P → Save as PDF</strong> (desktop)
          or the browser share menu (mobile).
        </p>
      </div>
    </div>
  )
}
