'use server'
// @ts-nocheck

import { db, workLogs, workTypes, users } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const workLogSchema = z.object({
  siteId:      z.string(),
  workTypeId:  z.string(),
  quantity:    z.coerce.number().positive(),
  unit:        z.string(),
  date:        z.string(),
  description: z.string().optional(),
  offlineId:   z.string().optional(),
})

const workTypeSchema = z.object({
  siteId: z.string(),
  name:   z.string().min(1),
  unit:   z.string().min(1),
})

export async function createWorkLog(formData: FormData | Record<string, unknown>) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  const raw = formData instanceof FormData ? Object.fromEntries(formData) : formData
  const parsed = workLogSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  // Deduplicate by offlineId
  if (parsed.data.offlineId) {
    const [existing] = await db.select().from(workLogs).where(eq(workLogs.offlineId, parsed.data.offlineId)).limit(1)
    if (existing) return { success: true, id: existing.id }
  }

  const id = crypto.randomUUID()
  await db.insert(workLogs).values({ id, ...parsed.data, userId: session.userId, synced: true })

  revalidatePath(`/sites/${parsed.data.siteId}`)
  return { success: true, id }
}

export async function getWorkLogs(siteId: string, from?: string, to?: string) {
  const session = await requireSession()
  if (!session) return []

  const conditions = [eq(workLogs.siteId, siteId)]
  if (from) conditions.push(gte(workLogs.date, from))
  if (to) conditions.push(lte(workLogs.date, to))

  const rows = await db
    .select({
      id:          workLogs.id,
      siteId:      workLogs.siteId,
      quantity:    workLogs.quantity,
      unit:        workLogs.unit,
      date:        workLogs.date,
      description: workLogs.description,
      createdAt:   workLogs.createdAt,
      workType:    workTypes,
      supervisor:  { id: users.id, name: users.name },
    })
    .from(workLogs)
    .leftJoin(workTypes, eq(workLogs.workTypeId, workTypes.id))
    .leftJoin(users, eq(workLogs.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(workLogs.date))

  return rows
}

export async function createWorkType(formData: FormData) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  const parsed = workTypeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const id = crypto.randomUUID()
  await db.insert(workTypes).values({ id, ...parsed.data })

  revalidatePath(`/sites/${parsed.data.siteId}`)
  return { success: true, id }
}

export async function deleteWorkLog(id: string) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  await db.delete(workLogs).where(eq(workLogs.id, id))
  return { success: true }
}

export async function syncOfflineWorkLogs(entries: Array<{ offlineId: string; data: Record<string, unknown> }>) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  let synced = 0
  for (const entry of entries) {
    const result = await createWorkLog({ ...entry.data, offlineId: entry.offlineId })
    if (result?.success) synced++
  }
  return { synced }
}