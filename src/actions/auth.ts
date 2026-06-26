'use server'
// @ts-nocheck

import { db, users, cashbookAccess, cashbooks } from '@/lib/db'
import { createSession, deleteSession, getSession } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { redirect } from 'next/navigation'

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export async function loginAction(formData: FormData) {
  try {
    const parsed = loginSchema.safeParse({
      email:    formData.get('email'),
      password: formData.get('password'),
    })
    if (!parsed.success) return { error: 'Please enter a valid email and password' }

    const email = parsed.data.email.toLowerCase().trim()
    const [user] = await db.select().from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (user) {
      if (!user.isActive) return { error: 'Account is disabled. Contact admin.' }
      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
      if (!valid) return { error: 'Invalid email or password' }

      const role = (user.role === 'ADMIN' ? 'ADMIN' : 'SUPERVISOR') as 'ADMIN' | 'SUPERVISOR'
      await createSession({ userId: user.id, email: user.email, role, name: user.name })
      return { success: true, redirectTo: '/dashboard' }
    }

    // Fall back to a restricted, single-cashbook access account
    const [access] = await db.select().from(cashbookAccess)
      .where(eq(cashbookAccess.email, email))
      .limit(1)
    if (!access) return { error: 'Invalid email or password' }

    const validAccess = await bcrypt.compare(parsed.data.password, access.passwordHash)
    if (!validAccess) return { error: 'Invalid email or password' }

    const [book] = await db.select().from(cashbooks).where(eq(cashbooks.id, access.cashbookId)).limit(1)
    if (!book) return { error: 'This access has been revoked. Contact admin.' }

    await createSession({
      userId: access.id, email: access.email, role: 'CASHBOOK_ACCESS', name: access.name,
      cashbookId: access.cashbookId, siteId: book.siteId,
    })
    return { success: true, redirectTo: `/book/${access.cashbookId}` }
  } catch (e: any) {
    console.error('Login error:', e?.message)
    return { error: 'Login failed. Please try again.' }
  }
}

export async function logoutAction() {
  await deleteSession()
  redirect('/login')
}

export async function getCurrentUser() {
  const session = await getSession()
  if (!session) return null
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
  return user ?? null
}