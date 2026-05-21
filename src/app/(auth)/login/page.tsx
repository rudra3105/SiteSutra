'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginAction } from '@/actions/auth'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError('')
    const result = await loginAction(new FormData(e.currentTarget))
    setLoading(false)
    if (result?.error) setError(result.error)
    else { router.push('/dashboard'); router.refresh() }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500 shadow-lg mb-4">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">SiteSutra</h1>
          <p className="text-slate-600 text-sm mt-1">Construction Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-800 text-center">Sign in to your account</h2>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" className="input" placeholder="admin@company.com"
                required autoComplete="email" />
            </div>
            <div>
              <label className="label">Password</label>
              <input name="password" type="password" className="input" placeholder="••••••••"
                required autoComplete="current-password" />
            </div>
            <button type="submit" disabled={loading} className="btn w-full text-base py-3.5 disabled:opacity-60">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600">
          © {new Date().getFullYear()} SiteSutra · Developed by{' '}
          <a href="https://www.webriseglobal.com" target="_blank" rel="noopener noreferrer"
            className="text-brand-500 hover:underline font-medium">
            Webrise Global
          </a>
        </p>
      </div>
    </div>
  )
}
