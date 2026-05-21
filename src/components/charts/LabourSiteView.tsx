'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export function LabourSiteView({ sites }: { sites: any[] }) {
  const [selectedSite, setSelectedSite] = useState(sites[0]?.id || '')
  const [labour, setLabour] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'workers' | 'attendance' | 'payroll'>('workers')
  const [attendance, setAttendance] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (!selectedSite) return
    setLoading(true)
    fetch(`/api/sites/${selectedSite}/workers`)
      .then(r => r.json())
      .then(d => setLabour(d.data || []))
      .finally(() => setLoading(false))
  }, [selectedSite])

  useEffect(() => {
    if (!selectedSite || tab !== 'attendance') return
    fetch(`/api/attendance?siteId=${selectedSite}&date=${selectedDate}`)
      .then(r => r.json())
      .then(d => setAttendance(Array.isArray(d) ? d : (d.data || [])))
  }, [selectedSite, tab, selectedDate])

  const statusColors: Record<string, string> = {
    PRESENT: 'badge-green', ABSENT: 'badge-red', HALF_DAY: 'badge-yellow',
    LEAVE: 'badge-blue', HOLIDAY: 'badge-gray',
  }

  return (
    <div className="space-y-4">
      {/* Site selector */}
      <div>
        <label className="label">Select Site</label>
        <select className="select max-w-xs" value={selectedSite} onChange={e => setSelectedSite(e.target.value)}>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['workers', 'attendance', 'payroll'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20' : 'text-slate-600 hover:text-white hover:bg-slate-100'
            }`}>{t}</button>
        ))}
      </div>

      {tab === 'workers' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-700 text-sm">{labour.length} worker{labour.length !== 1 ? 's' : ''}</p>
            {selectedSite && <Link href={`/labour/new?siteId=${selectedSite}`} className="btn-primary text-xs">+ Add Worker</Link>}
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1,2,3].map(i => <div key={i} className="card h-24 skeleton" />)}
            </div>
          ) : labour.length === 0 ? (
            <div className="card text-center py-10 text-slate-600">No workers on this site</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {labour.map(w => (
                <div key={w.id} className="card flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-400 font-bold">{w.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 font-medium text-sm truncate">{w.name}</p>
                    <p className="text-slate-700 text-xs">{w.trade}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <input type="date" className="input max-w-[180px]" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            <Link href={`/quick-add?type=attendance&siteId=${selectedSite}`} className="btn-primary text-sm">
              Mark Attendance
            </Link>
          </div>
          {attendance.length === 0 ? (
            <div className="card text-center py-10 text-slate-600">No attendance records for this date</div>
          ) : (
            <div className="card divide-y divide-slate-200">
              {attendance.map((a: any) => (
                <div key={a.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                  <div>
                    <p className="text-slate-800 text-sm font-medium">{a.worker?.name ?? a.labour?.name ?? 'Unknown'}</p>
                    <p className="text-slate-700 text-xs">{a.worker?.trade ?? a.labour?.trade ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(a.overtime ?? 0) > 0 && <span className="text-xs text-yellow-400">+{a.overtime}h OT</span>}
                    <span className={`badge ${statusColors[a.status] || 'badge-gray'}`}>{a.status.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'payroll' && (
        <div className="card text-center py-10 text-slate-600">
          <p className="font-medium text-slate-900 mb-1">Payroll Module</p>
          <p className="text-sm">Select a date range to generate payroll summary</p>
          <Link href={`/reports?type=payroll&siteId=${selectedSite}`} className="btn-secondary text-sm mt-4 inline-flex">
            Generate Payroll Report
          </Link>
        </div>
      )}
    </div>
  )
}
