'use server'
// @ts-nocheck

import { db, materials, materialLogs, idealRules, workTypes, workLogs } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const materialSchema = z.object({
  siteId: z.string(),
  name:   z.string().min(1),
  unit:   z.string().min(1),
})

const materialLogSchema = z.object({
  siteId:     z.string(),
  materialId: z.string(),
  type:       z.enum(['PURCHASE', 'USAGE', 'RETURN', 'ADJUSTMENT']),
  quantity:   z.coerce.number().positive(),
  unitPrice:  z.coerce.number().optional(),
  notes:      z.string().optional(),
  date:       z.string().optional(),
  offlineId:  z.string().optional(),
})

const idealRuleSchema = z.object({
  siteId:      z.string(),
  workTypeId:  z.string(),
  materialId:  z.string(),
  idealQtyPer: z.coerce.number().positive(),
  description: z.string().optional(),
})

export async function createMaterial(formData: FormData) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  const parsed = materialSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0].message }
  const id = crypto.randomUUID()
  await db.insert(materials).values({ id, ...parsed.data })
  revalidatePath('/materials')
  return { success: true, id }
}

export async function logMaterial(formData: FormData | Record<string, unknown>) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  const raw = formData instanceof FormData ? Object.fromEntries(formData) : formData
  const parsed = materialLogSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }
  if (parsed.data.offlineId) {
    const [existing] = await db.select().from(materialLogs).where(eq(materialLogs.offlineId, parsed.data.offlineId)).limit(1)
    if (existing) return { success: true, id: existing.id }
  }
  const id = crypto.randomUUID()
  await db.insert(materialLogs).values({
    id, ...parsed.data,
    date: parsed.data.date || new Date().toISOString().split('T')[0],
    synced: true,
  })
  revalidatePath('/materials')
  return { success: true, id }
}

// Returns: { id, name, unit, siteId, stock, purchased, used, logs[] }
export async function getMaterialsBySite(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  const mats = await db.select().from(materials).where(eq(materials.siteId, siteId))
  const logs = await db.select().from(materialLogs).where(eq(materialLogs.siteId, siteId))
  return mats.map((mat: any) => {
    const matLogs  = logs.filter((l: any) => l.materialId === mat.id)
    const purchased = matLogs.filter((l: any) => l.type === 'PURCHASE' || l.type === 'RETURN').reduce((s: number, l: any) => s + l.quantity, 0)
    const used      = matLogs.filter((l: any) => l.type === 'USAGE' || l.type === 'ADJUSTMENT').reduce((s: number, l: any) => s + l.quantity, 0)
    const stock     = purchased - used
    return { ...mat, purchased, used, stock, logs: matLogs }
  })
}

export async function createIdealRule(formData: FormData) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  const parsed = idealRuleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0].message }
  const id = crypto.randomUUID()
  await db.insert(idealRules).values({ id, ...parsed.data })
  revalidatePath(`/sites/${parsed.data.siteId}`)
  return { success: true, id }
}

// Returns: { workTypeName, materialName, unit, totalWork, workUnit, idealQty, actualQty, variance, variancePercent, isAlert }
export async function getVarianceReport(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  const rules: any[] = await db
    .select({ rule: idealRules, workType: workTypes, material: materials })
    .from(idealRules)
    .leftJoin(workTypes, eq(idealRules.workTypeId, workTypes.id))
    .leftJoin(materials, eq(idealRules.materialId, materials.id))
    .where(eq(idealRules.siteId, siteId))
  const wLogs   = await db.select().from(workLogs).where(eq(workLogs.siteId, siteId))
  const mLogs   = await db.select().from(materialLogs).where(and(eq(materialLogs.siteId, siteId), eq(materialLogs.type, 'USAGE')))

  return rules.map(({ rule, workType, material }: any) => {
    const totalWork       = wLogs.filter((l: any) => l.workTypeId === rule.workTypeId).reduce((s: number, l: any) => s + l.quantity, 0)
    const idealQty        = totalWork * rule.idealQtyPer
    const actualQty       = mLogs.filter((l: any) => l.materialId === rule.materialId).reduce((s: number, l: any) => s + l.quantity, 0)
    const variancePct     = idealQty > 0 ? ((actualQty - idealQty) / idealQty) * 100 : 0
    return {
      workTypeName:    workType?.name ?? 'Unknown',
      materialName:    material?.name ?? 'Unknown',
      unit:            material?.unit ?? '',
      totalWork,
      workUnit:        workType?.unit ?? '',
      idealQty,
      actualQty,
      variance:        actualQty - idealQty,
      variancePercent: Math.round(variancePct * 10) / 10,
      isAlert:         Math.abs(variancePct) > 5,
    }
  })
}

export async function syncOfflineMaterials(entries: Array<{ offlineId: string; data: Record<string, unknown> }>) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }
  let synced = 0
  for (const entry of entries) {
    const result = await logMaterial({ ...entry.data, offlineId: entry.offlineId })
    if (result?.success) synced++
  }
  return { synced }
}