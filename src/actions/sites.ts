'use server'
// @ts-nocheck

import { db, sites, siteAccess, users, workLogs, labour, materialLogs } from '@/lib/db'
import { requireSession, requireAdmin } from '@/lib/auth/session'
import { eq, and, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const siteSchema = z.object({
  name:        z.string().min(2),
  location:    z.string().min(2),
  description: z.string().optional(),
  status:      z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'PLANNING']).default('ACTIVE'),
  budget:      z.coerce.number().min(0).default(0),
  startDate:   z.string(),
  endDate:     z.string().optional(),
})

export async function createSite(formData: FormData) {
  const session = await requireAdmin()
  if (!session) return { error: 'Unauthorized' }

  const parsed = siteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const id = crypto.randomUUID()
  await db.insert(sites).values({
    id,
    ...parsed.data,
    createdById: session.userId,
  })

  revalidatePath('/sites')
  return { success: true, id }
}

export async function updateSite(id: string, formData: FormData) {
  const session = await requireAdmin()
  if (!session) return { error: 'Unauthorized' }

  const parsed = siteSchema.partial().safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  await db.update(sites).set({ ...parsed.data, updatedAt: new Date().toISOString() }).where(eq(sites.id, id))

  revalidatePath('/sites')
  revalidatePath(`/sites/${id}`)
  return { success: true }
}

export async function getSites() {
  const session = await requireSession()
  if (!session) return []

  if (session.role === 'ADMIN') {
    return db.select().from(sites).orderBy(sites.createdAt)
  }

  // Supervisor: only assigned sites
  const access = await db.select().from(siteAccess).where(eq(siteAccess.userId, session.userId))
  if (access.length === 0) return []

  const siteIds = access.map((a: any) => a.siteId)
  return db.select().from(sites).where(inArray(sites.id, siteIds)).orderBy(sites.createdAt)
}

export async function getSiteById(siteId: string) {
  const session = await requireSession()
  if (!session) return null

  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1)
  return site ?? null
}

export async function assignSiteAccess(userId: string, siteId: string) {
  await requireAdmin()
  const id = crypto.randomUUID()
  await db.insert(siteAccess).values({ id, userId, siteId }).onConflictDoNothing()
  revalidatePath(`/sites/${siteId}`)
  return { success: true }
}

export async function removeSiteAccess(userId: string, siteId: string) {
  await requireAdmin()
  await db.delete(siteAccess).where(and(eq(siteAccess.userId, userId), eq(siteAccess.siteId, siteId)))
  revalidatePath(`/sites/${siteId}`)
  return { success: true }
}