'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createLabour } from '@/actions/labour'
import { Site } from '@/types'

interface Props {
  sites: Site[]
  preselectedSite?: string
}

export function AddLabourForm({ sites, preselectedSite }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createLabour(formData)

    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      router.push('/labour')
      router.refresh()
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="label">Site *</label>
        <select name="siteId" className="input" defaultValue={preselectedSite} required>
          <option value="">Select site...</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Full Name *</label>
        <input name="name" className="input" placeholder="e.g. Mohammed Ali" required minLength={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Trade / Role *</label>
          <input
            name="trade"
            className="input"
            placeholder="e.g. Mason, Helper, Carpenter"
            required
            list="trades-list"
          />
          <datalist id="trades-list">
            {['Mason', 'Helper', 'Carpenter', 'Electrician', 'Plumber', 'Welder', 'Painter', 'Tiler', 'Steel Fixer', 'Foreman', 'Supervisor'].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="label">Daily Rate (AED) *</label>
          <input
            name="dailyWage"
            type="number"
            className="input"
            placeholder="e.g. 150"
            min="0"
            step="0.01"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Phone</label>
          <input
            name="phone"
            type="tel"
            className="input"
            placeholder="+971 50 123 4567"
          />
        </div>

        <div>
          <label className="label">Join Date *</label>
          <input
            name="joinDate"
            type="date"
            className="input"
            defaultValue={today}
            required
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn flex-1 disabled:opacity-60"
        >
          {loading ? 'Adding...' : 'Add Worker'}
        </button>
      </div>
    </form>
  )
}
