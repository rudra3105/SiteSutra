'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSite } from '@/actions/sites'

export default function NewSitePage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await createSite(new FormData(e.currentTarget))
    setLoading(false)
    if (result?.error) { setError(result.error) }
    else { router.push('/sites'); router.refresh() }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">New Site</h1>
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 text-sm">{error}</div>}
        <div>
          <label className="label">Site Name *</label>
          <input name="name" className="input" required placeholder="e.g. Al Barsha Tower Block A" />
        </div>
        <div>
          <label className="label">Location *</label>
          <input name="location" className="input" required placeholder="e.g. Al Barsha, Dubai" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea name="description" className="input" rows={3} placeholder="Brief description..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Budget (AED) *</label>
            <input name="budget" type="number" className="input" required min="0" step="1000" placeholder="5000000" />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" className="input">
              <option value="ACTIVE">Active</option>
              <option value="PLANNING">Planning</option>
              <option value="PAUSED">Paused</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start Date *</label>
            <input name="startDate" type="date" className="input" required />
          </div>
          <div>
            <label className="label">End Date</label>
            <input name="endDate" type="date" className="input" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">
            {loading ? 'Creating...' : 'Create Site'}
          </button>
        </div>
      </form>
    </div>
  )
}
