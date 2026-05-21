import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface OfflineEntry {
  id: string
  type: 'worklog' | 'attendance' | 'material' | 'materiallog'
  data: Record<string, unknown>
  createdAt: string
  synced: boolean
}

interface BuildTrackDB extends DBSchema {
  pending_sync: {
    key: string
    value: OfflineEntry
    indexes: { 'by-type': string; 'by-synced': number }
  }
  cached_sites: {
    key: string
    value: { id: string; name: string; location: string; updatedAt: string }
  }
  cached_workers: {
    key: string
    value: { id: string; name: string; trade: string; siteId: string }
  }
  cached_worktypes: {
    key: string
    value: { id: string; name: string; unit: string; siteId: string }
  }
  cached_materials: {
    key: string
    value: { id: string; name: string; unit: string; siteId: string }
  }
  app_settings: {
    key: string
    value: { key: string; value: string }
  }
}

let dbInstance: IDBPDatabase<BuildTrackDB> | null = null

export async function getOfflineDB(): Promise<IDBPDatabase<BuildTrackDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<BuildTrackDB>('buildtrack-offline', 1, {
    upgrade(db) {
      const pendingStore = db.createObjectStore('pending_sync', { keyPath: 'id' })
      pendingStore.createIndex('by-type', 'type')
      pendingStore.createIndex('by-synced', 'synced')

      db.createObjectStore('cached_sites', { keyPath: 'id' })
      db.createObjectStore('cached_workers', { keyPath: 'id' })
      db.createObjectStore('cached_worktypes', { keyPath: 'id' })
      db.createObjectStore('cached_materials', { keyPath: 'id' })
      db.createObjectStore('app_settings', { keyPath: 'key' })
    },
  })

  return dbInstance
}

export async function addOfflineEntry(
  type: OfflineEntry['type'],
  data: Record<string, unknown>
): Promise<string> {
  const db = await getOfflineDB()
  const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  await db.put('pending_sync', {
    id,
    type,
    data: { ...data, offlineId: id },
    createdAt: new Date().toISOString(),
    synced: false,
  })
  return id
}

export async function getPendingEntries(): Promise<OfflineEntry[]> {
  const db = await getOfflineDB()
  const all = await db.getAll('pending_sync')
  return all.filter(e => !e.synced)
}

export async function markEntrySynced(id: string): Promise<void> {
  const db = await getOfflineDB()
  const entry = await db.get('pending_sync', id)
  if (entry) {
    await db.put('pending_sync', { ...entry, synced: true })
  }
}

export async function getPendingCount(): Promise<number> {
  const entries = await getPendingEntries()
  return entries.length
}

export async function cacheSiteData(sites: BuildTrackDB['cached_sites']['value'][]): Promise<void> {
  const db = await getOfflineDB()
  const tx = db.transaction('cached_sites', 'readwrite')
  for (const site of sites) {
    await tx.store.put(site)
  }
  await tx.done
}

export async function getCachedSites(): Promise<BuildTrackDB['cached_sites']['value'][]> {
  const db = await getOfflineDB()
  return db.getAll('cached_sites')
}

export async function cacheWorkers(workers: BuildTrackDB['cached_workers']['value'][]): Promise<void> {
  const db = await getOfflineDB()
  const tx = db.transaction('cached_workers', 'readwrite')
  for (const w of workers) await tx.store.put(w)
  await tx.done
}

export async function getCachedWorkers(siteId?: string): Promise<BuildTrackDB['cached_workers']['value'][]> {
  const db = await getOfflineDB()
  const all = await db.getAll('cached_workers')
  return siteId ? all.filter(w => w.siteId === siteId) : all
}

export async function cacheWorkTypes(types: BuildTrackDB['cached_worktypes']['value'][]): Promise<void> {
  const db = await getOfflineDB()
  const tx = db.transaction('cached_worktypes', 'readwrite')
  for (const t of types) await tx.store.put(t)
  await tx.done
}

export async function getCachedWorkTypes(siteId?: string): Promise<BuildTrackDB['cached_worktypes']['value'][]> {
  const db = await getOfflineDB()
  const all = await db.getAll('cached_worktypes')
  return siteId ? all.filter(t => t.siteId === siteId) : all
}

export async function cacheMaterials(mats: BuildTrackDB['cached_materials']['value'][]): Promise<void> {
  const db = await getOfflineDB()
  const tx = db.transaction('cached_materials', 'readwrite')
  for (const m of mats) await tx.store.put(m)
  await tx.done
}

export async function getCachedMaterials(siteId?: string): Promise<BuildTrackDB['cached_materials']['value'][]> {
  const db = await getOfflineDB()
  const all = await db.getAll('cached_materials')
  return siteId ? all.filter(m => m.siteId === siteId) : all
}
