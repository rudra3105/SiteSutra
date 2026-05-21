'use client'
import { useOnlineSync } from '@/hooks/useOnlineSync'

export function SyncStatus({ compact }: { compact?: boolean }) {
  const { isOnline, isSyncing, pendingCount, syncNow } = useOnlineSync()
  if (pendingCount === 0 && isOnline) return null
  if (compact) {
    return (
      <button onClick={syncNow} className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
        isSyncing ? 'text-blue-600 bg-blue-50' : pendingCount > 0 ? 'text-amber-600 bg-amber-50' : 'text-slate-600'
      }`}>
        <svg className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {pendingCount > 0 ? pendingCount : ''}
      </button>
    )
  }
  return (
    <button onClick={syncNow} className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-colors ${
      isSyncing ? 'text-blue-600 bg-blue-50' : pendingCount > 0 ? 'text-amber-600 bg-amber-50' : 'text-slate-600 bg-slate-50'
    }`}>
      <svg className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {isSyncing ? 'Syncing...' : pendingCount > 0 ? `${pendingCount} pending sync` : 'All synced'}
    </button>
  )
}
