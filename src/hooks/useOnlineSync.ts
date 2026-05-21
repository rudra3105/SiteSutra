'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getPendingEntries, markEntrySynced, getPendingCount } from '@/lib/offline/db'

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncedAt: Date | null
  syncError: string | null
}

export function useOnlineSync() {
  const [state, setState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    syncError: null,
  })
  const syncingRef = useRef(false)

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount()
      setState((prev) => ({ ...prev, pendingCount: count }))
    } catch {
      // IndexedDB not available (SSR)
    }
  }, [])

  // Perform sync
  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return
    syncingRef.current = true

    setState((prev) => ({ ...prev, isSyncing: true, syncError: null }))

    try {
      const pending = await getPendingEntries()
      if (pending.length === 0) {
        setState((prev) => ({ ...prev, isSyncing: false, lastSyncedAt: new Date() }))
        syncingRef.current = false
        return
      }

      const worklogs = pending.filter((e) => e.type === 'worklog').map((e) => e.data)
      const attendance = pending.filter((e) => e.type === 'attendance').map((e) => e.data)
      const materials = pending.filter((e) => e.type === 'material' || e.type === 'materiallog').map((e) => e.data)

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worklogs, attendance, materials }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || 'Sync failed')
      }

      const result = await res.json()

      // Mark each synced item
      for (const entry of pending) {
        await markEntrySynced(entry.id)
      }

      const newPendingCount = await getPendingCount()
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        pendingCount: newPendingCount,
        lastSyncedAt: new Date(),
        syncError: null,
      }))

      console.log(`✅ Synced: ${result.synced ?? pending.length} entries`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error'
      setState((prev) => ({ ...prev, isSyncing: false, syncError: message }))
      console.error('Sync error:', message)
    } finally {
      syncingRef.current = false
    }
  }, [])

  useEffect(() => {
    // Initial pending count
    refreshPendingCount()

    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }))
      // Auto-sync when coming back online
      setTimeout(syncNow, 1000)
    }

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Poll pending count every 30 seconds
    const interval = setInterval(refreshPendingCount, 30_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [syncNow, refreshPendingCount])

  return {
    ...state,
    syncNow,
    refreshPendingCount,
  }
}
