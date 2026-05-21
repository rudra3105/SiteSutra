'use server'
// @ts-nocheck

import { db, users, siteAccess, sites } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const createUserSchema = z.object({
  email:    z.string().email(),
  name:     z.string().min(2),
  password: z.string().min(6),
  role:     z.enum(['ADMIN', 'SUPERVISOR']).default('SUPERVISOR'),
  phone:    z.string().optional(),
})

const updateUserSchema = z.object({
  name:     z.string().min(2).optional(),
  role:     z.enum(['ADMIN', 'SUPERVISOR']).optional(),
  phone:    z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  password: z.string().min(6).optional(),
})

export async function createUser(data: Record<string, unknown>) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const parsed = createUserSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.errors[0].message }
  const existing = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1)
  if (existing.length > 0) return { error: 'Email already in use' }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10)
  const id = crypto.randomUUID()
  const { password, ...rest } = parsed.data
  await db.insert(users).values({ id, ...rest, passwordHash })
  revalidatePath('/settings')
  return { success: true, id }
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const parsed = updateUserSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.errors[0].message }
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (parsed.data.name     !== undefined) update.name     = parsed.data.name
  if (parsed.data.role     !== undefined) update.role     = parsed.data.role
  if (parsed.data.phone    !== undefined) update.phone    = parsed.data.phone
  if (parsed.data.isActive !== undefined) update.isActive = parsed.data.isActive
  if (parsed.data.password)               update.passwordHash = await bcrypt.hash(parsed.data.password, 10)
  await db.update(users).set(update as never).where(eq(users.id, id))
  revalidatePath('/settings')
  return { success: true }
}

export async function getAllUsers() {
  const session = await requireAdmin()
  if (!session) return []

  const allUsers   = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role, phone: users.phone, isActive: users.isActive, createdAt: users.createdAt }).from(users).orderBy(users.name)
  const allAccess  = await db.select({ userId: siteAccess.userId, siteId: siteAccess.siteId, siteName: sites.name }).from(siteAccess).leftJoin(sites, eq(siteAccess.siteId, sites.id))

  return allUsers.map((u: any) => ({
    ...u,
    siteAccess: allAccess.filter((a: any) => a.userId === u.id),
  }))
}

export async function deleteUser(id: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (id === session.userId) return { error: 'Cannot delete yourself' }
  await db.delete(siteAccess).where(eq(siteAccess.userId, id))
  await db.delete(users).where(eq(users.id, id))
  revalidatePath('/settings')
  return { success: true }
}