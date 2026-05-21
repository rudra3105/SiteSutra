'use server'
// @ts-nocheck

import { db, siteLocations } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { eq, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

const WORK_STAGES = ['FOUNDATION', 'ERECTION', 'STRINGING', 'FINISHING', 'COMPLETED']

export async function getSiteLocations(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  return db.select().from(siteLocations)
    .where(eq(siteLocations.siteId, siteId))
    .orderBy(asc(siteLocations.locationNo))
}

export async function createSiteLocation(data: {
  siteId: string
  locationNo: string
  towerType: string
  span?: string
  workStage?: string
  notes?: string
}) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  if (!data.locationNo?.trim()) return { error: 'Location number is required' }
  if (!data.towerType?.trim()) return { error: 'Tower type is required' }

  const id = crypto.randomUUID()
  await db.insert(siteLocations).values({
    id,
    siteId:     data.siteId,
    locationNo: data.locationNo.trim(),
    towerType:  data.towerType.trim(),
    span:       data.span?.trim() || null,
    workStage:  data.workStage || 'FOUNDATION',
    notes:      data.notes?.trim() || null,
  })

  revalidatePath(`/sites/${data.siteId}/worklogs`)
  return { success: true, id }
}

export async function updateLocationStage(id: string, workStage: string, siteId: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  await db.update(siteLocations)
    .set({ workStage, updatedAt: new Date().toISOString() })
    .where(eq(siteLocations.id, id))

  revalidatePath(`/sites/${siteId}/worklogs`)
  return { success: true }
}

export async function updateSiteLocation(id: string, data: {
  locationNo?: string
  towerType?: string
  span?: string
  workStage?: string
  notes?: string
  siteId: string
}) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  await db.update(siteLocations)
    .set({
      ...(data.locationNo && { locationNo: data.locationNo.trim() }),
      ...(data.towerType  && { towerType:  data.towerType.trim()  }),
      span:      data.span?.trim() || null,
      workStage: data.workStage || 'FOUNDATION',
      notes:     data.notes?.trim() || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(siteLocations.id, id))

  revalidatePath(`/sites/${data.siteId}/worklogs`)
  return { success: true }
}

export async function deleteSiteLocation(id: string, siteId: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  await db.delete(siteLocations).where(eq(siteLocations.id, id))

  revalidatePath(`/sites/${siteId}/worklogs`)
  return { success: true }
}

export async function getSiteLocationStats(siteId: string) {
  const locs = await getSiteLocations(siteId)
  const total = locs.length
  const byStage: Record<string, number> = {}
  for (const stage of WORK_STAGES) byStage[stage] = 0
  for (const loc of locs) byStage[loc.workStage] = (byStage[loc.workStage] ?? 0) + 1
  const completed = byStage['COMPLETED'] ?? 0
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return { total, byStage, completed, pct }
}