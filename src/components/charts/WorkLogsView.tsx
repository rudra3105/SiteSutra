'use client'

import { useState } from 'react'
import {
  createSiteLocation,
  updateLocationStage,
  updateSiteLocation,
  deleteSiteLocation,
} from '@/actions/locations'
import { createWorkLog } from '@/actions/worklogs'

// ── Constants ─────────────────────────────────────────────────

const WORK_STAGES = [
  { value: 'FOUNDATION', label: 'Foundation', color: 'bg-amber-500',   text: 'text-amber-700',  bg: 'bg-amber-50  border-amber-300'  },
  { value: 'ERECTION',   label: 'Erection',   color: 'bg-blue-500',    text: 'text-blue-700',   bg: 'bg-blue-50   border-blue-300'   },
  { value: 'STRINGING',  label: 'Stringing',  color: 'bg-purple-500',  text: 'text-purple-700', bg: 'bg-purple-50 border-purple-300' },
  { value: 'FINISHING',  label: 'Finishing',  color: 'bg-orange-500',  text: 'text-orange-700', bg: 'bg-orange-50 border-orange-300' },
  { value: 'COMPLETED',  label: 'Completed',  color: 'bg-emerald-500', text: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-300'},
]

const TOWER_TYPES = [
  'Tangent', 'Angle', 'Dead End', 'Section', 'Transposition',
  'River Crossing', 'Road Crossing', 'Terminal', 'Custom'
]

function stageInfo(value: string) {
  return WORK_STAGES.find(s => s.value === value) ?? WORK_STAGES[0]
}

// ── Sub-components ────────────────────────────────────────────

function StageBadge({ stage }: { stage: string }) {
  const s = stageInfo(stage)
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
      {s.label}
    </span>
  )
}

function StageProgress({ locations }: { locations: any[] }) {
  if (locations.length === 0) return null
  const counts: Record<string, number> = {}
  for (const s of WORK_STAGES) counts[s.value] = 0
  for (const l of locations) counts[l.workStage] = (counts[l.workStage] ?? 0) + 1

  return (
    <div className="space-y-2">
      {WORK_STAGES.map(s => {
        const count = counts[s.value] ?? 0
        const pct   = locations.length > 0 ? Math.round((count / locations.length) * 100) : 0
        return (
          <div key={s.value}>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className={s.text}>{s.label}</span>
              <span className="text-slate-600">{count} location{count !== 1 ? 's' : ''} ({pct}%)</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${s.color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WorkLogBar({ logs }: { logs: any[] }) {
  const groups: Record<string, number> = {}
  for (const log of logs) {
    const name = log.workType?.name ?? 'Other'
    groups[name] = (groups[name] ?? 0) + (log.quantity ?? 0)
  }
  const entries = Object.entries(groups)
  if (entries.length === 0) return null
  const max = Math.max(...entries.map(([, v]) => v), 1)
  const COLORS = ['bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500']

  return (
    <div className="space-y-2">
      {entries.map(([name, total], i) => (
        <div key={name}>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-800">{name}</span>
            <span className="text-slate-600">{total.toFixed(1)}</span>
          </div>
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${COLORS[i % COLORS.length]}`}
              style={{ width: `${(total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export function WorkLogsView({
  siteId,
  logs,
  workTypes,
  initialLocations,
}: {
  siteId: string
  logs: any[]
  workTypes: any[]
  initialLocations: any[]
}) {
  const [locations, setLocations]       = useState<any[]>(initialLocations)
  const [activeTab, setActiveTab]       = useState<'locations' | 'logs'>('locations')
  const [showAddLoc, setShowAddLoc]     = useState(false)
  const [editingLoc, setEditingLoc]     = useState<any | null>(null)
  const [showAddLog, setShowAddLog]     = useState(false)
  const [loading, setLoading]           = useState(false)
  const [stageLoading, setStageLoading] = useState<string | null>(null)
  const [error, setError]               = useState('')
  const [ok, setOk]                     = useState('')

  function flash(msg: string) { setOk(msg); setTimeout(() => setOk(''), 3000) }

  // ── Add / Edit Location ─────────────────────────────────────
  async function handleSaveLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd   = new FormData(e.currentTarget)
    const data = {
      siteId,
      locationNo: fd.get('locationNo') as string,
      towerType:  fd.get('towerType')  as string,
      span:       fd.get('span')       as string,
      workStage:  fd.get('workStage')  as string,
      notes:      fd.get('notes')      as string,
    }

    let result: any
    if (editingLoc) {
      result = await updateSiteLocation(editingLoc.id, data)
    } else {
      result = await createSiteLocation(data)
    }
    setLoading(false)
    if (result?.error) { setError(result.error); return }

    flash(editingLoc ? 'Location updated!' : 'Location added!')
    setShowAddLoc(false); setEditingLoc(null)
    window.location.reload()
  }

  // ── Stage change ────────────────────────────────────────────
  async function handleStageChange(locId: string, newStage: string) {
    setStageLoading(locId)
    await updateLocationStage(locId, newStage, siteId)
    setLocations(prev => prev.map(l => l.id === locId ? { ...l, workStage: newStage } : l))
    setStageLoading(null)
    flash('Stage updated')
  }

  // ── Delete location ─────────────────────────────────────────
  async function handleDeleteLoc(id: string, name: string) {
    if (!confirm(`Delete location "${name}"?`)) return
    await deleteSiteLocation(id, siteId)
    setLocations(prev => prev.filter(l => l.id !== id))
    flash('Location deleted')
  }

  // ── Add work log ────────────────────────────────────────────
  async function handleAddLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const wtId = fd.get('workTypeId') as string
    const wt   = workTypes.find(w => w.id === wtId)
    const result = await createWorkLog({
      siteId,
      workTypeId:  wtId,
      quantity:    Number(fd.get('quantity')),
      unit:        wt?.unit ?? '',
      date:        fd.get('date') as string,
      description: fd.get('description') as string,
    })
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    flash('Work log added!'); setShowAddLog(false)
    window.location.reload()
  }

  const totalLocations  = locations.length
  const completed       = locations.filter(l => l.workStage === 'COMPLETED').length
  const overallPct      = totalLocations > 0 ? Math.round((completed / totalLocations) * 100) : 0

  return (
    <div className="space-y-5">

      {ok    && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">✓ {ok}</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">{error}</div>}

      {/* Overall progress */}
      {totalLocations > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Overall Site Progress</h3>
            <span className="text-slate-600 text-sm font-semibold">{completed}/{totalLocations} completed ({overallPct}%)</span>
          </div>
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${overallPct}%` }} />
          </div>
          <StageProgress locations={locations} />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-slate-200">
        {([
          ['locations', `Locations (${locations.length})`],
          ['logs',      `Work Logs (${logs.length})`],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === t ? 'border-orange-500 text-orange-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── LOCATIONS TAB ── */}
      {activeTab === 'locations' && (
        <div className="space-y-4">

          <div className="flex justify-end">
            <button onClick={() => { setShowAddLoc(true); setEditingLoc(null) }} className="btn text-sm">
              + Add Location
            </button>
          </div>

          {/* Add / Edit form */}
          {(showAddLoc || editingLoc) && (
            <form onSubmit={handleSaveLocation} className="card p-5 border-2 border-orange-200 space-y-4">
              <h3 className="font-bold text-slate-900">
                {editingLoc ? `Edit — ${editingLoc.locationNo}` : 'Add New Location'}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Location No. *</label>
                  <input name="locationNo" className="input" required
                    defaultValue={editingLoc?.locationNo ?? ''}
                    placeholder="e.g. T-01, L-05, Tower 12" />
                </div>
                <div>
                  <label className="label">Tower Type *</label>
                  <input name="towerType" className="input" required list="tower-types"
                    defaultValue={editingLoc?.towerType ?? ''}
                    placeholder="e.g. Tangent, Angle..." />
                  <datalist id="tower-types">
                    {TOWER_TYPES.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Span</label>
                  <input name="span" className="input"
                    defaultValue={editingLoc?.span ?? ''}
                    placeholder="e.g. A–B, 250m, Tower 1–2" />
                  <p className="text-slate-500 text-xs mt-1">The span this location covers</p>
                </div>
                <div>
                  <label className="label">Work Stage</label>
                  <select name="workStage" className="input" defaultValue={editingLoc?.workStage ?? 'FOUNDATION'}>
                    {WORK_STAGES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <input name="notes" className="input"
                  defaultValue={editingLoc?.notes ?? ''}
                  placeholder="Any additional notes..." />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAddLoc(false); setEditingLoc(null) }}
                  className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">
                  {loading ? 'Saving...' : editingLoc ? 'Update Location' : 'Add Location'}
                </button>
              </div>
            </form>
          )}

          {/* Locations list */}
          {locations.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-slate-700 font-bold mb-1">No locations added yet</p>
              <p className="text-slate-500 text-sm mb-4">
                Add tower locations with their type and span, then track the work stage for each one
              </p>
              <button onClick={() => setShowAddLoc(true)} className="btn">Add First Location</button>
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map(loc => (
                <div key={loc.id} className="card p-4">
                  {/* Location header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{loc.locationNo}</span>
                        <span className="badge badge-blue text-xs">{loc.towerType}</span>
                        {loc.span && (
                          <span className="text-slate-600 text-xs font-medium">
                            Span: {loc.span}
                          </span>
                        )}
                      </div>
                      {loc.notes && <p className="text-slate-500 text-xs mt-1">{loc.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StageBadge stage={loc.workStage} />
                      <button onClick={() => { setEditingLoc(loc); setShowAddLoc(false) }}
                        className="text-slate-400 hover:text-slate-700 transition-colors p-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteLoc(loc.id, loc.locationNo)}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Stage selector — one-tap update */}
                  <div>
                    <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-2">Change Stage</p>
                    <div className="flex flex-wrap gap-1.5">
                      {WORK_STAGES.map(s => {
                        const active = loc.workStage === s.value
                        const spin   = stageLoading === loc.id
                        return (
                          <button key={s.value} disabled={spin}
                            onClick={() => handleStageChange(loc.id, s.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all disabled:opacity-50 ${
                              active
                                ? `${s.bg} ${s.text} border-current`
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                            }`}>
                            {spin && active ? '⟳' : s.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── WORK LOGS TAB ── */}
      {activeTab === 'logs' && (
        <div className="space-y-4">

          <div className="flex items-center justify-between">
            <p className="text-slate-600 text-sm">{logs.length} entries recorded</p>
            <button onClick={() => setShowAddLog(!showAddLog)} className="btn text-sm">+ Add Log</button>
          </div>

          {showAddLog && (
            <form onSubmit={handleAddLog} className="card p-5 border-2 border-orange-200 space-y-4">
              <h3 className="font-bold text-slate-900">Add Work Log</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Work Type *</label>
                  <select name="workTypeId" className="input" required>
                    <option value="">Select work type...</option>
                    {workTypes.map((wt: any) => (
                      <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Quantity *</label>
                  <input name="quantity" type="number" className="input" required min="0.01" step="0.01" placeholder="e.g. 45" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date *</label>
                  <input name="date" type="date" className="input" required defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <input name="description" className="input" placeholder="Brief note..." />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddLog(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">{loading ? 'Saving...' : 'Add Log'}</button>
              </div>
            </form>
          )}

          {/* Chart */}
          {logs.length > 0 && (
            <div className="card p-4 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">Work Progress by Type</h3>
              <WorkLogBar logs={logs} />
            </div>
          )}

          {/* Logs list */}
          <div className="card overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-500 text-sm mb-3">No work logs yet</p>
                <button onClick={() => setShowAddLog(true)} className="btn text-sm">Add First Log</button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.map((log: any, i: number) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-slate-900 text-sm font-bold">{log.workType?.name ?? 'Work'}</p>
                      <p className="text-slate-500 text-xs">
                        {log.description ?? ''}
                        {log.supervisor?.name ? ` · ${log.supervisor.name}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-orange-700 font-bold text-sm">
                        {(log.quantity ?? 0).toFixed(1)} {log.workType?.unit ?? log.unit}
                      </p>
                      <p className="text-slate-500 text-xs">{log.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
