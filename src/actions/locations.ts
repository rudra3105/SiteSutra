'use server'
// @ts-nocheck

import { db, siteLocations } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { eq, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { STAGE_COLUMNS, stageColumn } from '@/lib/stages'

const WORK_STAGES = ['FOUNDATION', 'ERECTION', 'STRINGING', 'FINISHING', 'COMPLETED']

function today() {
  return new Date().toISOString().split('T')[0]
}

// Builds { excavationStatus, excavationDate, foundationStatus, foundationDate, ... }
// from a flat { excavation: 'COMP', foundation: 'ROW', ... } input, auto-filling the
// date whenever a stage's value counts as completed, and clearing it otherwise.
function buildStageFields(input: Record<string, string | undefined>, existing?: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const col of STAGE_COLUMNS) {
    if (!(col.key in input)) continue
    const value = input[col.key]?.trim() || null
    out[col.statusField] = value
    if (col.isCompleted(value)) {
      out[col.dateField] = existing?.[col.dateField] || today()
    } else {
      out[col.dateField] = null
    }
  }
  return out
}

// Builds { foundationRa, erectionRa, ... } from a flat { foundation: '1st RA', ... }
// input — only for stages that carry an raField (Excavation/OPGW aren't billed via RA).
function buildRaFields(input: Record<string, string | undefined>) {
  const out: Record<string, any> = {}
  for (const col of STAGE_COLUMNS) {
    if (!col.raField || !(col.key in input)) continue
    out[col.raField] = input[col.key]?.trim() || null
  }
  return out
}

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
  notes?: string
  stages?: Record<string, string | undefined>
  ra?: Record<string, string | undefined>
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
    notes:      data.notes?.trim() || null,
    ...buildStageFields(data.stages || {}),
    ...buildRaFields(data.ra || {}),
  })

  revalidatePath(`/sites/${data.siteId}/worklogs`)
  return { success: true, id }
}

export async function updateSiteLocation(id: string, data: {
  locationNo?: string
  towerType?: string
  span?: string
  notes?: string
  stages?: Record<string, string | undefined>
  ra?: Record<string, string | undefined>
  siteId: string
}) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  const [existing] = await db.select().from(siteLocations).where(eq(siteLocations.id, id))

  await db.update(siteLocations)
    .set({
      ...(data.locationNo && { locationNo: data.locationNo.trim() }),
      ...(data.towerType  && { towerType:  data.towerType.trim()  }),
      span:      data.span?.trim() || null,
      notes:     data.notes?.trim() || null,
      ...buildStageFields(data.stages || {}, existing),
      ...buildRaFields(data.ra || {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(siteLocations.id, id))

  revalidatePath(`/sites/${data.siteId}/worklogs`)
  return { success: true }
}

// One-tap update for a single stage column (e.g. changing just "Erection" to COMP).
// Auto-fills/clears that stage's date column based on whether the new value counts as completed.
export async function updateLocationStageField(id: string, stageKey: string, value: string, siteId: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  const col = stageColumn(stageKey)
  if (!col) return { error: 'Unknown stage' }

  const [existing] = await db.select().from(siteLocations).where(eq(siteLocations.id, id))
  const fields = buildStageFields({ [stageKey]: value }, existing)

  await db.update(siteLocations)
    .set({ ...fields, updatedAt: new Date().toISOString() })
    .where(eq(siteLocations.id, id))

  revalidatePath(`/sites/${siteId}/worklogs`)
  return { success: true, ...fields }
}

// One-tap update for a single stage's RA billing round.
export async function updateLocationRaField(id: string, stageKey: string, value: string, siteId: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  const col = stageColumn(stageKey)
  if (!col?.raField) return { error: 'Stage is not RA-billed' }

  const field = col.raField
  await db.update(siteLocations)
    .set({ [field]: value?.trim() || null, updatedAt: new Date().toISOString() })
    .where(eq(siteLocations.id, id))

  revalidatePath(`/sites/${siteId}/worklogs`)
  return { success: true, [field]: value?.trim() || null }
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
  for (const col of STAGE_COLUMNS) {
    byStage[col.key] = locs.filter((l: any) => col.isCompleted(l[col.statusField])).length
  }
  // A tower counts as fully completed once its final stage (OPGW) is done.
  const opgw = stageColumn('opgw')!
  const completed = locs.filter((l: any) => opgw.isCompleted(l[opgw.statusField])).length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return { total, byStage, completed, pct }
}
