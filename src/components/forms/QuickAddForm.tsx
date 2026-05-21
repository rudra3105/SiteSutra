'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addOfflineEntry, getCachedWorkers, getCachedWorkTypes, getCachedMaterials } from '@/lib/offline/db'

type FormType = 'worklog' | 'attendance' | 'material'

interface Props {
  sites: { id: string; name: string; location: string }[]
  defaultType: FormType
  defaultSiteId?: string
  session: { userId: string; name: string; role: string }
}

export function QuickAddForm({ sites, defaultType, defaultSiteId, session }: Props) {
  const router = useRouter()
  const [type, setType] = useState<FormType>(defaultType)
  const [siteId, setSiteId] = useState(defaultSiteId || sites[0]?.id || '')
  const [isOnline, setIsOnline] = useState(true)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [workers, setWorkers] = useState<{ id: string; name: string; trade: string }[]>([])
  const [workTypes, setWorkTypes] = useState<{ id: string; name: string; unit: string }[]>([])
  const [materials, setMaterials] = useState<{ id: string; name: string; unit: string }[]>([])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!siteId) return
    const load = async () => {
      if (isOnline) {
        // Fetch from API and cache
        try {
          const [w, wt, m] = await Promise.all([
            fetch(`/api/sites/${siteId}/workers`).then(r => r.json()),
            fetch(`/api/sites/${siteId}/worktypes`).then(r => r.json()),
            fetch(`/api/sites/${siteId}/materials`).then(r => r.json()),
          ])
          setWorkers(w.data || [])
          setWorkTypes(wt.data || [])
          setMaterials(m.data || [])
        } catch {
          // Fall back to cache
          const [w, wt, m] = await Promise.all([
            getCachedWorkers(siteId),
            getCachedWorkTypes(siteId),
            getCachedMaterials(siteId),
          ])
          setWorkers(w)
          setWorkTypes(wt)
          setMaterials(m)
        }
      } else {
        const [w, wt, m] = await Promise.all([
          getCachedWorkers(siteId),
          getCachedWorkTypes(siteId),
          getCachedMaterials(siteId),
        ])
        setWorkers(w)
        setWorkTypes(wt)
        setMaterials(m)
      }
    }
    load()
  }, [siteId, isOnline])

  const today = new Date().toISOString().split('T')[0]

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = Object.fromEntries(formData)

    try {
      if (!isOnline) {
        // Store offline
        await addOfflineEntry(type, { ...data, siteId })
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
          router.back()
        }, 1500)
        return
      }

      // Online: submit to API
      const endpoint = type === 'worklog' ? '/api/worklogs' : type === 'attendance' ? '/api/attendance' : '/api/materials/log'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, siteId }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
          router.back()
        }, 1500)
      }
    } catch {
      await addOfflineEntry(type, { ...data, siteId })
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        router.back()
      }, 1500)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-slate-800 font-semibold text-lg">Saved!</p>
        {!isOnline && <p className="text-slate-700 text-sm text-center">Stored offline — will sync when internet is available</p>}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-600 hover:text-white p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white">Quick Add</h1>
        {!isOnline && (
          <span className="badge badge-yellow ml-auto">OFFLINE</span>
        )}
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { id: 'worklog', label: 'Work Log', icon: '🔨' },
          { id: 'attendance', label: 'Attendance', icon: '👷' },
          { id: 'material', label: 'Material', icon: '📦' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setType(t.id as FormType)}
            className={`py-3 px-2 rounded-xl text-sm font-medium text-center transition-all ${
              type === t.id
                ? 'bg-brand-500/15 border border-brand-500/40 text-brand-400'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-surface-300'
            }`}
          >
            <div className="text-xl mb-1">{t.icon}</div>
            <div className="text-xs">{t.label}</div>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Site selector */}
        <div>
          <label className="label">Site *</label>
          <select className="select" value={siteId} onChange={e => setSiteId(e.target.value)} required>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Work Log form */}
        {type === 'worklog' && (
          <>
            <div>
              <label className="label">Work Type *</label>
              <select name="workTypeId" className="select" required>
                <option value="">Select work type...</option>
                {workTypes.map(wt => (
                  <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quantity *</label>
              <input name="quantity" type="number" step="0.01" min="0.01" className="input" placeholder="Enter quantity" required />
            </div>
            <input name="unit" type="hidden" value={workTypes.find(wt => wt.id === '')?.unit || 'unit'} />
            <div>
              <label className="label">Date *</label>
              <input name="date" type="date" className="input" defaultValue={today} required />
            </div>
            <div>
              <label className="label">Notes</label>
              <input name="description" className="input" placeholder="Optional notes..." />
            </div>
          </>
        )}

        {/* Attendance form */}
        {type === 'attendance' && (
          <>
            <div>
              <label className="label">Worker *</label>
              <select name="labourId" className="select" required>
                <option value="">Select worker...</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.name} — {w.trade}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input name="date" type="date" className="input" defaultValue={today} required />
            </div>
            <div>
              <label className="label">Status *</label>
              <div className="grid grid-cols-2 gap-2">
                {(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'] as const).map(s => (
                  <label key={s} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-3 cursor-pointer hover:border-brand-500/30 transition-colors">
                    <input type="radio" name="status" value={s} className="accent-brand-500" required />
                    <span className="text-sm text-white">{s.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Overtime Hours</label>
              <input name="overtime" type="number" step="0.5" min="0" max="12" className="input" placeholder="0" />
            </div>
          </>
        )}

        {/* Material form */}
        {type === 'material' && (
          <>
            <div>
              <label className="label">Material *</label>
              <select name="materialId" className="select" required>
                <option value="">Select material...</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Entry Type *</label>
              <select name="type" className="select" required>
                <option value="USAGE">Usage (Used at site)</option>
                <option value="PURCHASE">Purchase (Received at site)</option>
                <option value="RETURN">Return</option>
              </select>
            </div>
            <div>
              <label className="label">Quantity *</label>
              <input name="quantity" type="number" step="0.01" min="0.01" className="input" placeholder="Enter quantity" required />
            </div>
            <div>
              <label className="label">Unit Price (₹) — optional</label>
              <input name="unitPrice" type="number" step="0.01" min="0" className="input" placeholder="0.00" />
            </div>
            <div>
              <label className="label">Date *</label>
              <input name="date" type="date" className="input" defaultValue={today} required />
            </div>
            <div>
              <label className="label">Notes</label>
              <input name="notes" className="input" placeholder="Optional notes..." />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full mt-2 text-base"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          ) : isOnline ? 'Save' : 'Save Offline'}
        </button>
      </form>
    </div>
  )
}
