// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateSite } from '@/actions/sites'

export default function EditSitePage({ params, searchParams }: any) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const result = await updateSite(params.siteId, fd)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    router.push(`/sites/${params.siteId}`)
    router.refresh()
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 p-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Edit Site</h2>
        <p className="text-slate-600 text-sm">Update site information</p>
      </div>
      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        <div>
          <label className="label">Site Name *</label>
          <input name="name" className="input" required defaultValue={searchParams?.name ?? ''} placeholder="e.g. Andheri Tower Block A" />
        </div>
        <div>
          <label className="label">Location *</label>
          <input name="location" className="input" required defaultValue={searchParams?.location ?? ''} placeholder="e.g. Andheri West, Mumbai" />
        </div>
        <div>
          <label className="label">Description</label>
          <input name="description" className="input" defaultValue={searchParams?.description ?? ''} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Status</label>
            <select name="status" className="input" defaultValue={searchParams?.status ?? 'ACTIVE'}>
              <option value="ACTIVE">Active</option>
              <option value="PLANNING">Planning</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="label">Budget (₹)</label>
            <input name="budget" type="number" className="input" defaultValue={searchParams?.budget ?? ''} placeholder="15000000" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date *</label>
            <input name="startDate" type="date" className="input" required defaultValue={searchParams?.startDate ?? ''} />
          </div>
          <div>
            <label className="label">End Date</label>
            <input name="endDate" type="date" className="input" defaultValue={searchParams?.endDate ?? ''} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">{loading ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </div>
  )
}
