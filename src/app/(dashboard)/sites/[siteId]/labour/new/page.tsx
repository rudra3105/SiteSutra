// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createLabour } from '@/actions/labour'

export default function NewWorkerPage({ params }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('siteId', params.siteId)
    const result = await createLabour(fd)
    setLoading(false)
    if (result?.error) setError(result.error)
    else router.push(`/sites/${params.siteId}/labour`)
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Add New Worker</h2>
        <p className="text-slate-600 text-sm">Register a worker to this site</p>
      </div>
      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        <div>
          <label className="label">Full Name *</label>
          <input name="name" className="input" required placeholder="e.g. Ramesh Patil" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Trade *</label>
            <input name="trade" className="input" required placeholder="Mason, Helper..." list="trades" />
            <datalist id="trades">
              {['Mason','Helper','Carpenter','Electrician','Plumber','Painter','Tiler','Steel Fixer','Foreman'].map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className="label">Daily Rate (₹) *</label>
            <input name="dailyWage" type="number" className="input" required min="0" placeholder="700" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Phone</label>
            <input name="phone" type="tel" className="input" placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="label">Join Date *</label>
            <input name="joinDate" type="date" className="input" required defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">{loading ? 'Adding...' : 'Add Worker'}</button>
        </div>
      </form>
    </div>
  )
}
