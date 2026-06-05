'use client'

import { useState } from 'react'
import { createTeam, addTeamMember, removeTeamMember, deleteTeam, markTeamAttendance } from '@/actions/teams'
import { createLabour, deleteLabour } from '@/actions/labour'
import { markAttendance } from '@/actions/labour'

const TRADES = ['Mason','Helper','Carpenter','Electrician','Plumber','Painter','Tiler','Steel Fixer','Foreman','Supervisor','Driver']
const STATUS_OPTIONS = ['PRESENT','ABSENT','HALF_DAY','LEAVE']

type Tab = 'workers' | 'teams' | 'attendance'

export function LabourManagementView({ siteId, initialWorkers, initialTeams, todayAttendance }: {
  siteId: string
  initialWorkers: any[]
  initialTeams: any[]
  todayAttendance: any[]
}) {
  const [tab, setTab]           = useState<Tab>('workers')
  const [workers]               = useState(initialWorkers)
  const [teams]                 = useState(initialTeams)
  const [attendance]            = useState(todayAttendance)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [ok, setOk]             = useState('')

  // Add worker form state
  const [showAddWorker, setShowAddWorker] = useState(false)
  // Add team form state
  const [showAddTeam, setShowAddTeam]   = useState(false)
  const [teamName, setTeamName]         = useState('')
  const [teamMethod, setTeamMethod]     = useState('INDIVIDUAL')
  // Team member management
  const [managingTeam, setManagingTeam] = useState<string | null>(null)
  // Individual attendance
  const [attDate, setAttDate]           = useState(new Date().toISOString().split('T')[0])
  const [attStatuses, setAttStatuses]   = useState<Record<string, string>>({})
  // Team attendance
  const [teamAttDate, setTeamAttDate]   = useState(new Date().toISOString().split('T')[0])

  function flash(msg: string) { setOk(msg); setTimeout(() => setOk(''), 3000) }

  async function handleDeleteWorker(id: string, name: string) {
    if (!confirm(`Remove worker "${name}" from this site?`)) return
    await deleteLabour(id, siteId)
    flash('Worker removed')
    window.location.reload()
  }

  async function handleAddWorker(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('siteId', siteId)
    const result = await createLabour(fd)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    flash('Worker added!'); setShowAddWorker(false)
    window.location.reload()
  }

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const result = await createTeam(siteId, teamName, teamMethod)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    flash('Team created!'); setShowAddTeam(false); setTeamName('')
    window.location.reload()
  }

  async function handleAddMember(teamId: string, labourId: string) {
    await addTeamMember(teamId, labourId, siteId)
    flash('Member added'); window.location.reload()
  }

  async function handleRemoveMember(teamId: string, labourId: string) {
    await removeTeamMember(teamId, labourId, siteId)
    flash('Member removed'); window.location.reload()
  }

  async function handleDeleteTeam(teamId: string, name: string) {
    if (!confirm(`Delete team "${name}"?`)) return
    await deleteTeam(teamId, siteId)
    flash('Team deleted'); window.location.reload()
  }

  async function handleMarkTeamAttendance(teamId: string, status: string) {
    setLoading(true)
    const result = await markTeamAttendance(teamId, siteId, teamAttDate, status)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    flash(`Marked ${result.marked ?? 0} workers as ${status}`)
    window.location.reload()
  }

  async function handleIndividualAttendance(labourId: string, status: string) {
    const newStatuses = { ...attStatuses, [labourId]: status }
    setAttStatuses(newStatuses)
  }

  async function submitIndividualAttendance() {
    setLoading(true); setError('')
    let marked = 0
    for (const [labourId, status] of Object.entries(attStatuses)) {
      const result = await markAttendance({ siteId, labourId, date: attDate, status })
      if (!result?.error) marked++
    }
    setLoading(false)
    flash(`Saved attendance for ${marked} workers`)
    setAttStatuses({})
    window.location.reload()
  }

  const presentCount = attendance.filter((r: any) => r.att?.status === 'PRESENT' || r.status === 'PRESENT').length

  return (
    <div className="space-y-4">

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">{error}</div>}
      {ok    && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">✓ {ok}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-slate-600 text-xs font-semibold uppercase mb-1">Total Workers</p>
          <p className="text-2xl font-bold text-slate-900">{workers.length}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-slate-600 text-xs font-semibold uppercase mb-1">Teams</p>
          <p className="text-2xl font-bold text-blue-600">{teams.length}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-slate-600 text-xs font-semibold uppercase mb-1">Present Today</p>
          <p className="text-2xl font-bold text-emerald-600">{presentCount}</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {(['workers','teams','attendance'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${
              tab === t ? 'border-orange-500 text-orange-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}>
            {t === 'workers' ? `Workers (${workers.length})` : t === 'teams' ? `Teams (${teams.length})` : 'Attendance'}
          </button>
        ))}
      </div>

      {/* ── WORKERS TAB ── */}
      {tab === 'workers' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddWorker(!showAddWorker)} className="btn text-sm">+ Add Worker</button>
          </div>

          {showAddWorker && (
            <form onSubmit={handleAddWorker} className="card p-5 border-2 border-orange-200 space-y-4">
              <h3 className="font-bold text-slate-900">Add New Worker</h3>
              <div>
                <label className="label">Full Name *</label>
                <input name="name" className="input" required placeholder="e.g. Ramesh Patil" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Trade *</label>
                  <input name="trade" className="input" required list="trades-list" placeholder="Mason, Helper..." />
                  <datalist id="trades-list">{TRADES.map(t => <option key={t} value={t} />)}</datalist>
                </div>
                <div>
                  <label className="label">Labour Type</label>
                  <select name="labourType" className="input">
                    <option value="DAILY">Daily Wage</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="CONTRACT">Contract</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Daily Wages (₹) *</label>
                  <input name="dailyWage" type="number" className="input" required min="0" placeholder="700" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input name="phone" type="tel" className="input" placeholder="+91 98765 43210" />
                </div>
              </div>
              <div>
                <label className="label">Join Date *</label>
                <input name="joinDate" type="date" className="input" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddWorker(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">{loading ? 'Adding...' : 'Add Worker'}</button>
              </div>
            </form>
          )}

          <div className="card overflow-hidden">
            {workers.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-500 text-sm mb-3">No workers added yet</p>
                <button onClick={() => setShowAddWorker(true)} className="btn text-sm">Add First Worker</button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {workers.map((w: any) => {
                  const att = attendance.find((r: any) => r.worker?.id === w.id || r.labour_id === w.id || r.att?.labourId === w.id)
                  const attStatus = att?.att?.status ?? att?.status
                  return (
                    <div key={w.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-700 font-bold text-sm">{w.name[0]}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-900 font-bold text-sm truncate">{w.name}</p>
                          <p className="text-slate-500 text-xs">{w.trade} · ₹{w.dailyWage}/day</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {attStatus ? (
                          <span className={`badge ${attStatus === 'PRESENT' ? 'badge-green' : attStatus === 'ABSENT' ? 'badge-red' : 'badge-yellow'}`}>
                            {attStatus}
                          </span>
                        ) : (
                          <span className="badge badge-gray">Not Marked</span>
                        )}
                        <button type="button" onClick={() => handleDeleteWorker(w.id, w.name)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Remove worker">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TEAMS TAB ── */}
      {tab === 'teams' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddTeam(!showAddTeam)} className="btn text-sm">+ Create Team</button>
          </div>

          {showAddTeam && (
            <form onSubmit={handleAddTeam} className="card p-5 border-2 border-orange-200 space-y-4">
              <h3 className="font-bold text-slate-900">Create New Team</h3>
              <div>
                <label className="label">Team Name *</label>
                <input className="input" required value={teamName} onChange={e => setTeamName(e.target.value)}
                  placeholder="e.g. Civil Team A, Electrical Team" />
              </div>
              <div>
                <label className="label">Attendance Method</label>
                <select className="input" value={teamMethod} onChange={e => setTeamMethod(e.target.value)}>
                  <option value="INDIVIDUAL">Each worker separately</option>
                  <option value="TEAM">Whole team together</option>
                </select>
                <p className="text-slate-500 text-xs mt-1">
                  {teamMethod === 'TEAM' ? '→ Mark the whole team present/absent in one click' : '→ Mark each worker individually'}
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddTeam(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">{loading ? 'Creating...' : 'Create Team'}</button>
              </div>
            </form>
          )}

          {teams.length === 0 && !showAddTeam ? (
            <div className="card p-8 text-center">
              <p className="text-slate-500 text-sm mb-3">No teams yet. Create teams to group workers and mark attendance faster.</p>
              <button onClick={() => setShowAddTeam(true)} className="btn text-sm">Create First Team</button>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team: any) => {
                const isManaging = managingTeam === team.id
                const notInTeam = workers.filter((w: any) => !team.members?.some((m: any) => m?.id === w.id))
                return (
                  <div key={team.id} className="card overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{team.name}</h3>
                        <p className="text-slate-500 text-xs">
                          {team.members?.length ?? 0} members · {team.attendanceMethod === 'TEAM' ? 'Team attendance' : 'Individual attendance'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setManagingTeam(isManaging ? null : team.id)}
                          className="btn-secondary text-xs py-1.5 px-3">
                          {isManaging ? 'Done' : 'Manage'}
                        </button>
                        <button onClick={() => handleDeleteTeam(team.id, team.name)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1.5">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Current members */}
                    {(team.members ?? []).length > 0 && (
                      <div className="divide-y divide-slate-100">
                        {(team.members ?? []).map((m: any) => m && (
                          <div key={m.id} className="px-4 py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-700 font-bold text-xs">{m.name?.[0]}</span>
                              </div>
                              <div>
                                <p className="text-slate-900 text-xs font-semibold">{m.name}</p>
                                <p className="text-slate-500 text-xs">{m.trade}</p>
                              </div>
                            </div>
                            {isManaging && (
                              <button onClick={() => handleRemoveMember(team.id, m.id)}
                                className="text-xs text-red-600 hover:underline font-medium">Remove</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add members when managing */}
                    {isManaging && notInTeam.length > 0 && (
                      <div className="px-4 py-3 bg-orange-50 border-t border-orange-200">
                        <p className="text-orange-800 text-xs font-semibold mb-2">Add workers to this team:</p>
                        <div className="flex flex-wrap gap-2">
                          {notInTeam.map((w: any) => (
                            <button key={w.id} onClick={() => handleAddMember(team.id, w.id)}
                              className="text-xs px-3 py-1.5 rounded-xl bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 font-medium transition-colors">
                              + {w.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {(team.members ?? []).length === 0 && !isManaging && (
                      <div className="px-4 py-4 text-center">
                        <p className="text-slate-400 text-xs">No members yet. Click Manage to add workers.</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && (
        <div className="space-y-4">

          {/* Team attendance */}
          {teams.length > 0 && (
            <div className="card p-4 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">Team Attendance</h3>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input max-w-xs" value={teamAttDate} onChange={e => setTeamAttDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                {teams.map((team: any) => (
                  <div key={team.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <p className="text-slate-900 font-semibold text-sm">{team.name}</p>
                      <p className="text-slate-500 text-xs">{team.members?.length ?? 0} members</p>
                    </div>
                    <div className="flex gap-2">
                      {['PRESENT','ABSENT','HALF_DAY'].map(s => (
                        <button key={s} disabled={loading}
                          onClick={() => handleMarkTeamAttendance(team.id, s)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition-colors disabled:opacity-50 ${
                            s === 'PRESENT' ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100' :
                            s === 'ABSENT'  ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100' :
                            'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                          }`}>
                          {s === 'HALF_DAY' ? 'Half Day' : s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual attendance */}
          <div className="card p-4 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Individual Attendance</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={attDate} onChange={e => setAttDate(e.target.value)} />
              </div>
              {Object.keys(attStatuses).length > 0 && (
                <button onClick={submitIndividualAttendance} disabled={loading} className="btn text-sm mt-4 disabled:opacity-60">
                  {loading ? 'Saving...' : `Save Attendance (${Object.keys(attStatuses).length})`}
                </button>
              )}
            </div>

            {workers.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No workers added yet</p>
            ) : (
              <div className="space-y-2">
                {workers.map((w: any) => {
                  const current = attStatuses[w.id]
                  const todayAtt = attendance.find((r: any) => r.worker?.id === w.id || r.att?.labourId === w.id)
                  const todayStatus = todayAtt?.att?.status ?? todayAtt?.status
                  return (
                    <div key={w.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-700 font-bold text-xs">{w.name[0]}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-900 text-sm font-bold truncate">{w.name}</p>
                          <p className="text-slate-500 text-xs">{w.trade}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {['PRESENT','ABSENT','HALF_DAY'].map(s => (
                          <button key={s} onClick={() => handleIndividualAttendance(w.id, s)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border transition-all ${
                              current === s || (!current && todayStatus === s)
                                ? s === 'PRESENT' ? 'bg-emerald-500 border-emerald-500 text-white' :
                                  s === 'ABSENT'  ? 'bg-red-500 border-red-500 text-white' :
                                  'bg-amber-500 border-amber-500 text-white'
                                : 'bg-white border-slate-300 text-slate-600 hover:border-slate-500'
                            }`}>
                            {s === 'HALF_DAY' ? '½' : s === 'PRESENT' ? 'P' : 'A'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
