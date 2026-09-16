'use server'
// @ts-nocheck

import { db, siteLocations, customBillingOptions, customStageOptions } from '@/lib/db'
import { requireSession, requireAdmin } from '@/lib/auth/session'
import { eq, and, asc, sql } from 'drizzle-orm'
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
// input — only for stages that carry an raField (Excavation isn't billed via RA).
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
    .orderBy(sql`COALESCE(${siteLocations.sortOrder}, 999999999)`, asc(siteLocations.locationNo))
}

export async function createSiteLocation(data: {
  siteId: string
  locationNo: string
  towerType: string
  span?: string
  spanRemarks?: string
  notes?: string
  excludeFromTotal?: boolean
  stages?: Record<string, string | undefined>
  ra?: Record<string, string | undefined>
}) {
  const session = await requireAdmin()
  if (!session) return { error: 'Unauthorized' }

  if (!data.locationNo?.trim()) return { error: 'Location number is required' }
  if (!data.towerType?.trim()) return { error: 'Tower type is required' }

  const [maxRow] = await db.select({ max: sql<number>`COALESCE(MAX(${siteLocations.sortOrder}), -1)` })
    .from(siteLocations).where(eq(siteLocations.siteId, data.siteId))
  const nextOrder = (maxRow?.max ?? -1) + 1

  const id = crypto.randomUUID()
  await db.insert(siteLocations).values({
    id,
    siteId:      data.siteId,
    locationNo:  data.locationNo.trim(),
    towerType:   data.towerType.trim(),
    span:        data.span?.trim() || null,
    spanRemarks: data.spanRemarks?.trim() || null,
    notes:       data.notes?.trim() || null,
    sortOrder:   nextOrder,
    excludeFromTotal: !!data.excludeFromTotal,
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
  spanRemarks?: string
  notes?: string
  excludeFromTotal?: boolean
  stages?: Record<string, string | undefined>
  ra?: Record<string, string | undefined>
  siteId: string
}) {
  const session = await requireAdmin()
  if (!session) return { error: 'Unauthorized' }

  const [existing] = await db.select().from(siteLocations).where(eq(siteLocations.id, id))

  await db.update(siteLocations)
    .set({
      ...(data.locationNo && { locationNo: data.locationNo.trim() }),
      ...(data.towerType  && { towerType:  data.towerType.trim()  }),
      ...(data.span        !== undefined && { span:        data.span?.trim() || null }),
      ...(data.spanRemarks !== undefined && { spanRemarks: data.spanRemarks?.trim() || null }),
      notes:       data.notes?.trim() || null,
      excludeFromTotal: !!data.excludeFromTotal,
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
  const session = await requireAdmin()
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
  const session = await requireAdmin()
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

// ── Custom Billing (RA round) Options ───────────────────────────
// Fully client-managed — nothing hardcoded. Whatever the client has added
// (and not deleted) via the Billing Options modal is what populates the
// per-stage billing dropdowns; a brand-new site starts with none.

export async function getCustomBillingOptions(siteId: string) {
  const session = await requireSession()
  if (!session) return []

  return db.select().from(customBillingOptions)
    .where(eq(customBillingOptions.siteId, siteId))
    .orderBy(asc(customBillingOptions.name))
}

export async function createCustomBillingOption(siteId: string, name: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Unauthorized' }
  if (!name?.trim()) return { error: 'Name required' }

  const trimmed = name.trim()
  const existingForSite = await db.select().from(customBillingOptions)
    .where(eq(customBillingOptions.siteId, siteId))
  const dup = existingForSite.find((o: any) => o.name.toLowerCase() === trimmed.toLowerCase())
  if (dup) return { success: true, id: dup.id, name: dup.name }

  const id = crypto.randomUUID()
  await db.insert(customBillingOptions).values({ id, siteId, name: trimmed })
  revalidatePath(`/sites/${siteId}/worklogs`)
  return { success: true, id, name: trimmed }
}

export async function renameCustomBillingOption(id: string, newName: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Unauthorized' }
  if (!newName?.trim()) return { error: 'Name required' }

  const [existing] = await db.select().from(customBillingOptions).where(eq(customBillingOptions.id, id))
  if (!existing) return { error: 'Billing option not found' }

  const name = newName.trim()
  await db.update(customBillingOptions).set({ name }).where(eq(customBillingOptions.id, id))

  if (existing.name !== name) {
    const raFields = STAGE_COLUMNS.filter(c => c.raField).map(c => c.raField!)
    for (const field of raFields) {
      await db.update(siteLocations).set({ [field]: name })
        .where(and(eq(siteLocations.siteId, siteId), eq((siteLocations as any)[field], existing.name)))
    }
  }

  revalidatePath(`/sites/${siteId}/worklogs`)
  return { success: true, name }
}

export async function deleteCustomBillingOption(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Unauthorized' }

  const [existing] = await db.select().from(customBillingOptions).where(eq(customBillingOptions.id, id))
  await db.delete(customBillingOptions).where(eq(customBillingOptions.id, id))

  if (existing) {
    const raFields = STAGE_COLUMNS.filter(c => c.raField).map(c => c.raField!)
    for (const field of raFields) {
      await db.update(siteLocations).set({ [field]: null })
        .where(and(eq(siteLocations.siteId, siteId), eq((siteLocations as any)[field], existing.name)))
    }
  }

  revalidatePath(`/sites/${siteId}/worklogs`)
  return { success: true }
}

// ── Custom Stage Status Options ───────────────────────────────
// Per-column extra status values, added the same way custom billing options
// are. Every column always shows the fixed COMP/U-P/CLEAR/ROW set plus its
// own built-in extras (see stages.ts) first; these are appended after.

export async function getCustomStageOptions(siteId: string) {
  const session = await requireSession()
  if (!session) return []

  return db.select().from(customStageOptions)
    .where(eq(customStageOptions.siteId, siteId))
    .orderBy(asc(customStageOptions.name))
}

export async function createCustomStageOption(siteId: string, stageKey: string, name: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  if (!stageColumn(stageKey)) return { error: 'Unknown stage' }
  if (!name?.trim()) return { error: 'Name required' }

  const trimmed = name.trim()
  const existingForCol = await db.select().from(customStageOptions)
    .where(and(eq(customStageOptions.siteId, siteId), eq(customStageOptions.stageKey, stageKey)))
  const dup = existingForCol.find((o: any) => o.name.toLowerCase() === trimmed.toLowerCase())
  if (dup) return { success: true, id: dup.id, name: dup.name, stageKey }

  const id = crypto.randomUUID()
  await db.insert(customStageOptions).values({ id, siteId, stageKey, name: trimmed })
  revalidatePath(`/sites/${siteId}/worklogs`)
  return { success: true, id, name: trimmed, stageKey }
}

export async function renameCustomStageOption(id: string, newName: string, siteId: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  if (!newName?.trim()) return { error: 'Name required' }

  const [existing] = await db.select().from(customStageOptions).where(eq(customStageOptions.id, id))
  if (!existing) return { error: 'Status option not found' }

  const name = newName.trim()
  await db.update(customStageOptions).set({ name }).where(eq(customStageOptions.id, id))

  if (existing.name !== name) {
    const col = stageColumn(existing.stageKey)
    if (col) {
      await db.update(siteLocations).set({ [col.statusField]: name })
        .where(and(eq(siteLocations.siteId, siteId), eq((siteLocations as any)[col.statusField], existing.name)))
    }
  }

  revalidatePath(`/sites/${siteId}/worklogs`)
  return { success: true, name }
}

export async function deleteCustomStageOption(id: string, siteId: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  const [existing] = await db.select().from(customStageOptions).where(eq(customStageOptions.id, id))
  await db.delete(customStageOptions).where(eq(customStageOptions.id, id))

  if (existing) {
    const col = stageColumn(existing.stageKey)
    if (col) {
      await db.update(siteLocations).set({ [col.statusField]: null, [col.dateField]: null })
        .where(and(eq(siteLocations.siteId, siteId), eq((siteLocations as any)[col.statusField], existing.name)))
    }
  }

  revalidatePath(`/sites/${siteId}/worklogs`)
  return { success: true }
}
