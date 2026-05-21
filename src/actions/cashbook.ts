'use server'
// @ts-nocheck

import { db, cashbooks, cashbookEntries, parties } from '@/lib/db'
import { requireSession, requireAdmin } from '@/lib/auth/session'
import { eq, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createCashbook(siteId: string, name: string, description?: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const id = crypto.randomUUID()
  await db.insert(cashbooks).values({ id, siteId, name, description })
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, id }
}

export async function getCashbooks(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  return db.select().from(cashbooks).where(eq(cashbooks.siteId, siteId)).orderBy(cashbooks.createdAt)
}

export async function deleteCashbook(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.delete(cashbooks).where(eq(cashbooks.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

export async function addCashbookEntry(data: Record<string, unknown>) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const id = crypto.randomUUID()
  await db.insert(cashbookEntries).values({
    id,
    cashbookId:  data.cashbookId as string,
    siteId:      data.siteId as string,
    type:        data.type as string,
    category:    data.category as string,
    amount:      Number(data.amount),
    description: data.description as string,
    paymentMode: data.paymentMode as string,
    reference:   data.reference as string || null,
    vendor:      data.vendor as string || null,
    date:        data.date as string || new Date().toISOString().split('T')[0],
    lpoNumber:   data.lpoNumber as string || null,
    lpoStatus:   data.lpoStatus  as string || null,
    partyName:   data.partyName   as string || null,
    proofUrl:    data.proofUrl    as string || null,
  })
  revalidatePath(`/sites/${data.siteId as string}/accounting`)
  return { success: true, id }
}

export async function getCashbookEntries(cashbookId: string) {
  const session = await requireSession()
  if (!session) return []
  return db.select().from(cashbookEntries)
    .where(eq(cashbookEntries.cashbookId, cashbookId))
    .orderBy(desc(cashbookEntries.date))
}

export async function getCashbookSummary(cashbookId: string) {
  const entries = await getCashbookEntries(cashbookId)
  const income  = entries.filter((e: any) => e.type === 'INCOME').reduce((s: number, e: any) => s + e.amount, 0)
  const expense = entries.filter((e: any) => e.type === 'EXPENSE' || e.type === 'LPO').reduce((s: number, e: any) => s + e.amount, 0)
  return { income, expense, net: income - expense, entries }
}

export async function deleteCashbookEntry(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.delete(cashbookEntries).where(eq(cashbookEntries.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

// ── Party actions ─────────────────────────────────────────────

export async function getParties(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  return db.select().from(parties)
    .where(eq(parties.siteId, siteId))
    .orderBy(parties.name)
}

export async function createParty(siteId: string, name: string, type?: string, phone?: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (!name?.trim()) return { error: 'Party name is required' }
  const id = crypto.randomUUID()
  await db.insert(parties).values({ id, siteId, name: name.trim(), type: type?.trim() || null, phone: phone?.trim() || null })
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, id, name: name.trim() }
}

export async function deleteParty(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.delete(parties).where(eq(parties.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}