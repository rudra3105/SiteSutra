'use client'

import { useState } from 'react'
import { createUser, deleteUser } from '@/actions/users'
import { assignSiteAccess, removeSiteAccess } from '@/actions/sites'
import { createIdealRule } from '@/actions/materials'

type Tab = 'users' | 'newuser' | 'access' | 'rules'

export function SettingsView({
  users, sites, workTypes, materials,
}: {
  users: any[]
  sites: any[]
  workTypes: any[]
  materials: any[]
}) {
  const [tab, setTab]       = useState<Tab>('users')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  function flash(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  // ── Create User ───────────────────────────────────────────
  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const result = await createUser(Object.fromEntries(fd))
    setLoading(false)
    if (result?.error) { setError(result.error) }
    else { flash('User created!'); setTab('users'); window.location.reload() }
  }

  // ── Delete User ───────────────────────────────────────────
  async function handleDeleteUser(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return
    const result = await deleteUser(id)
    if (result?.error) setError(result.error)
    else { flash('User deleted'); window.location.reload() }
  }

  // ── Site Access ───────────────────────────────────────────
  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const userId = fd.get('userId') as string
    const siteId = fd.get('siteId') as string
    const result = await assignSiteAccess(userId, siteId)
    setLoading(false)
    if ((result as any)?.error) setError((result as any).error)
    else { flash('Access granted!'); window.location.reload() }
  }

  async function handleRemoveAccess(userId: string, siteId: string) {
    const result = await removeSiteAccess(userId, siteId)
    if ((result as any)?.error) setError((result as any).error)
    else { flash('Access removed'); window.location.reload() }
  }

  // ── Ideal Rules ───────────────────────────────────────────
  async function handleCreateRule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const result = await createIdealRule(new FormData(e.currentTarget))
    setLoading(false)
    if (result?.error) setError(result.error)
    else { flash('Rule created!'); (e.target as HTMLFormElement).reset() }
  }

  const supervisors = users.filter(u => u.role === 'SUPERVISOR')

  return (
    <div className="space-y-4">
      {/* Feedback */}
      {error   && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-sm">✓ {success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {([
          { key: 'users',   label: `Users (${users.length})` },
          { key: 'newuser', label: '+ New User' },
          { key: 'access',  label: 'Site Access' },
          { key: 'rules',   label: 'Ideal Rules' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setError('') }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Users List ── */}
      {tab === 'users' && (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-400 font-bold">{u.name[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-medium text-sm">{u.name}</p>
                <p className="text-slate-600 text-xs">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                {(u.siteAccess ?? []).length > 0 && (
                  <p className="text-slate-600 text-xs mt-0.5">
                    Sites: {u.siteAccess.map((a: any) => a.siteName).filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`badge ${u.role === 'ADMIN' ? 'badge-orange' : 'badge-blue'}`}>{u.role}</span>
                {!u.isActive && <span className="badge badge-gray">Inactive</span>}
                <button onClick={() => handleDeleteUser(u.id, u.name)}
                  className="text-slate-600 hover:text-red-700 transition-colors p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── New User Form ── */}
      {tab === 'newuser' && (
        <form onSubmit={handleCreateUser} className="card p-5 space-y-4 max-w-md">
          <h3 className="font-semibold text-white">Create New User</h3>
          <div>
            <label className="label">Full Name *</label>
            <input name="name" className="input" required placeholder="Ravi Kumar" />
          </div>
          <div>
            <label className="label">Email *</label>
            <input name="email" type="email" className="input" required placeholder="ravi@company.com" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" type="tel" className="input" placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="label">Role *</label>
            <select name="role" className="input" required>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="label">Password *</label>
            <input name="password" type="password" className="input" required minLength={6} placeholder="Min 6 characters" />
          </div>
          <button type="submit" disabled={loading} className="btn w-full disabled:opacity-60">
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </form>
      )}

      {/* ── Site Access ── */}
      {tab === 'access' && (
        <div className="space-y-4">
          <form onSubmit={handleAssign} className="card p-5 space-y-4 max-w-md">
            <h3 className="font-semibold text-white">Assign Site to Supervisor</h3>
            <div>
              <label className="label">Supervisor *</label>
              <select name="userId" className="input" required>
                <option value="">Select supervisor...</option>
                {supervisors.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Site *</label>
              <select name="siteId" className="input" required>
                <option value="">Select site...</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={loading} className="btn w-full disabled:opacity-60">
              {loading ? 'Assigning...' : 'Grant Access'}
            </button>
          </form>

          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 text-sm">Current Access</h3>
            {supervisors.map(u => (
              (u.siteAccess ?? []).length > 0 && (
                <div key={u.id} className="card p-4">
                  <p className="text-slate-900 font-medium text-sm mb-2">{u.name}</p>
                  <div className="space-y-1">
                    {u.siteAccess.map((a: any) => (
                      <div key={a.siteId} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{a.siteName ?? a.siteId}</span>
                        <button onClick={() => handleRemoveAccess(u.id, a.siteId)}
                          className="text-red-700 hover:text-red-300 transition-colors">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* ── Ideal Rules ── */}
      {tab === 'rules' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateRule} className="card p-5 space-y-4 max-w-md">
            <h3 className="font-semibold text-white">Add Ideal Consumption Rule</h3>
            <p className="text-slate-600 text-xs">Define how much material should be used per unit of work. E.g. 6.5 bags of cement per m³ of concrete poured.</p>
            <div>
              <label className="label">Site *</label>
              <select name="siteId" className="input" required>
                <option value="">Select site...</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Work Type *</label>
              <select name="workTypeId" className="input" required>
                <option value="">Select work type...</option>
                {workTypes.map(wt => (
                  <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit}) — {sites.find(s => s.id === wt.siteId)?.name ?? ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Material *</label>
              <select name="materialId" className="input" required>
                <option value="">Select material...</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit}) — {sites.find(s => s.id === m.siteId)?.name ?? ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Ideal Qty per Unit of Work *</label>
              <input name="idealQtyPer" type="number" step="0.001" min="0.001" className="input" required placeholder="e.g. 6.5" />
              <p className="text-slate-600 text-xs mt-1">Amount of material used per 1 unit of selected work type</p>
            </div>
            <div>
              <label className="label">Description</label>
              <input name="description" className="input" placeholder="e.g. 6.5 bags cement per m³ concrete" />
            </div>
            <button type="submit" disabled={loading} className="btn w-full disabled:opacity-60">
              {loading ? 'Saving...' : 'Save Rule'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
