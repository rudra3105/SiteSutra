'use server'
// @ts-nocheck

import { db, labour, attendance, users } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const labourSchema = z.object({
  siteId:    z.string(),
  name:      z.string().min(2),
  phone:     z.string().optional(),
  trade:     z.string().min(1),
  dailyWage: z.coerce.number().min(0),
  joinDate:  z.string(),
})

const attendanceSchema = z.object({
  siteId:    z.string(),
  labourId:  z.string(),
  date:      z.string(),
  status:    z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY']),
  halfDay:   z.coerce.boolean().default(false),
  overtime:  z.coerce.number().optional(),
  notes:     z.string().optional(),
  offlineId: z.string().optional(),
})

export async function createLabour(formData: FormData) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  const parsed = labourSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const id = crypto.randomUUID()
  await db.insert(labour).values({ id, ...parsed.data })

  revalidatePath(`/labour`)
  return { success: true, id }
}

export async function updateLabour(id: string, formData: FormData) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  const parsed = labourSchema.partial().safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  await db.update(labour).set({ ...parsed.data, updatedAt: new Date().toISOString() }).where(eq(labour.id, id))
  return { success: true }
}

export async function getLabourBySite(siteId: string) {
  const session = await requireSession()
  if (!session) return []

  return db.select().from(labour).where(eq(labour.siteId, siteId)).orderBy(labour.name)
}

export async function markAttendance(formData: FormData | Record<string, unknown>) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  const raw = formData instanceof FormData ? Object.fromEntries(formData) : formData
  const parsed = attendanceSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  // Deduplicate by offlineId
  if (parsed.data.offlineId) {
    const [existing] = await db.select().from(attendance).where(eq(attendance.offlineId, parsed.data.offlineId)).limit(1)
    if (existing) return { success: true, id: existing.id }
  }

  // Upsert: check if record exists for this labourId + date
  const dateStr = parsed.data.date.split('T')[0]
  const [existing] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.labourId, parsed.data.labourId), sql`date(${attendance.date}) = ${dateStr}`))
    .limit(1)

  if (existing) {
    await db.update(attendance).set({
      status:    parsed.data.status,
      halfDay:   parsed.data.halfDay,
      overtime:  parsed.data.overtime,
      notes:     parsed.data.notes,
      synced:    true,
    }).where(eq(attendance.id, existing.id))
    return { success: true, id: existing.id }
  }

  const id = crypto.randomUUID()
  await db.insert(attendance).values({
    id,
    siteId:    parsed.data.siteId,
    labourId:  parsed.data.labourId,
    userId:    session.userId,
    date:      dateStr,
    status:    parsed.data.status,
    halfDay:   parsed.data.halfDay,
    overtime:  parsed.data.overtime,
    notes:     parsed.data.notes,
    offlineId: parsed.data.offlineId,
    synced:    true,
  })

  return { success: true, id }
}

export async function getAttendanceByDate(siteId: string, date: string) {
  const session = await requireSession()
  if (!session) return []

  const dateStr = date.split('T')[0]
  return db
    .select({ attendance, worker: labour })
    .from(attendance)
    .leftJoin(labour, eq(attendance.labourId, labour.id))
    .where(and(eq(attendance.siteId, siteId), sql`date(${attendance.date}) = ${dateStr}`))
    .orderBy(labour.name)
}

export async function getAttendanceSummary(siteId: string, from: string, to: string) {
  const session = await requireSession()
  if (!session) return []

  return db
    .select({ attendance, worker: labour })
    .from(attendance)
    .leftJoin(labour, eq(attendance.labourId, labour.id))
    .where(and(eq(attendance.siteId, siteId), gte(attendance.date, from), lte(attendance.date, to)))
    .orderBy(desc(attendance.date))
}

export async function syncOfflineAttendance(entries: Array<{ offlineId: string; data: Record<string, unknown> }>) {
  const session = await requireSession()
  if (!session) return { error: 'Unauthorized' }

  let synced = 0
  for (const entry of entries) {
    const result = await markAttendance({ ...entry.data, offlineId: entry.offlineId })
    if (result?.success) synced++
  }
  return { synced }
}