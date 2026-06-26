'use server'
// @ts-nocheck

import { db, cashbooks, cashbookEntries, parties, cashbookCustomFields, customPaymentMethods, cashbookAccess } from '@/lib/db'
import { requireSession, requireAdmin } from '@/lib/auth/session'
import { eq, desc, and, gte, lte } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

// A book-access user may only act on the single cashbook they were granted.
async function requireBookAccess(cashbookId: string) {
  const session = await requireSession()
  if (!session) return null
  if (session.role === 'ADMIN') return session
  if (session.role === 'CASHBOOK_ACCESS' && session.cashbookId === cashbookId) return session
  return null
}

// ── Cashbooks CRUD ─────────────────────────────────────────────

export async function createCashbook(siteId: string, name: string, description?: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const id = crypto.randomUUID()
  await db.insert(cashbooks).values({ id, siteId, name: name.trim(), description: description?.trim() || null })
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, id }
}

export async function getCashbookById(cashbookId: string) {
  const session = await requireBookAccess(cashbookId)
  if (!session) return null
  const [book] = await db.select().from(cashbooks).where(eq(cashbooks.id, cashbookId))
  return book ?? null
}

export async function getCashbooks(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  return db.select().from(cashbooks).where(eq(cashbooks.siteId, siteId)).orderBy(cashbooks.createdAt)
}

export async function updateCashbook(id: string, name: string, description: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.update(cashbooks).set({ name: name.trim(), description: description?.trim() || null }).where(eq(cashbooks.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

export async function deleteCashbook(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.delete(cashbooks).where(eq(cashbooks.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

// ── Cashbook Entries CRUD ─────────────────────────────────────

export async function addCashbookEntry(data: Record<string, unknown>) {
  const session = await requireBookAccess(data.cashbookId as string)
  if (!session) return { error: 'Forbidden' }
  const id = crypto.randomUUID()
  await db.insert(cashbookEntries).values({
    id,
    cashbookId:        data.cashbookId as string,
    siteId:            data.siteId as string,
    type:              data.type as string,
    category:          data.category as string,
    amount:            Number(data.amount),
    description:       data.description as string,
    paymentMode:       data.paymentMode as string,
    reference:         (data.reference as string) || null,
    vendor:            (data.vendor as string) || null,
    date:              (data.date as string) || new Date().toISOString().split('T')[0],
    lpoNumber:         (data.lpoNumber as string) || null,
    lpoStatus:         (data.lpoStatus as string) || null,
    partyName:         (data.partyName as string) || null,
    proofUrl:          (data.proofUrl as string) || null,
    customFieldValues: data.customFieldValues ? JSON.stringify(data.customFieldValues) : null,
    addedBy:   session.name || null,
    addedById: session.userId || null,
  })
  revalidatePath(`/sites/${data.siteId as string}/accounting`)
  return { success: true, id }
}

export async function updateCashbookEntry(id: string, data: Record<string, unknown>, siteId: string) {
  const [existing] = await db.select().from(cashbookEntries).where(eq(cashbookEntries.id, id))
  if (!existing) return { error: 'Entry not found' }
  const session = await requireBookAccess(existing.cashbookId)
  if (!session) return { error: 'Forbidden' }
  await db.update(cashbookEntries).set({
    type:              data.type as string,
    category:          data.category as string,
    amount:            Number(data.amount),
    description:       data.description as string,
    paymentMode:       data.paymentMode as string,
    reference:         (data.reference as string) || null,
    vendor:            (data.vendor as string) || null,
    date:              data.date as string,
    lpoNumber:         (data.lpoNumber as string) || null,
    lpoStatus:         (data.lpoStatus as string) || null,
    partyName:         (data.partyName as string) || null,
    proofUrl:          (data.proofUrl as string) || null,
    customFieldValues: data.customFieldValues ? JSON.stringify(data.customFieldValues) : null,
    updatedAt:         new Date().toISOString(),
  }).where(eq(cashbookEntries.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

export async function getCashbookEntries(cashbookId: string) {
  const session = await requireBookAccess(cashbookId)
  if (!session) return []
  return db.select().from(cashbookEntries)
    .where(eq(cashbookEntries.cashbookId, cashbookId))
    .orderBy(desc(cashbookEntries.date))
}

export async function getAllEntriesBySite(siteId: string, filters?: {
  category?: string; type?: string; party?: string; dateFrom?: string; dateTo?: string
}) {
  const session = await requireSession()
  if (!session) return { entries: [], income: 0, expense: 0, net: 0 }
  const { inArray } = await import('drizzle-orm')
  const books = await db.select().from(cashbooks).where(eq(cashbooks.siteId, siteId))
  if (!books.length) return { entries: [], income: 0, expense: 0, net: 0 }
  const bookIds = books.map((b: any) => b.id)
  const bookMap: Record<string, string> = {}
  books.forEach((b: any) => { bookMap[b.id] = b.name })
  let entries: any[] = await db.select().from(cashbookEntries)
    .where(inArray(cashbookEntries.cashbookId, bookIds))
    .orderBy(desc(cashbookEntries.date))
  entries = entries.map((e: any) => ({ ...e, bookName: bookMap[e.cashbookId] ?? '' }))
  if (filters?.category) entries = entries.filter((e: any) => e.category === filters.category)
  if (filters?.type)     entries = entries.filter((e: any) => e.type === filters.type)
  if (filters?.party)    entries = entries.filter((e: any) => e.partyName === filters.party)
  if (filters?.dateFrom) entries = entries.filter((e: any) => e.date >= filters.dateFrom!)
  if (filters?.dateTo)   entries = entries.filter((e: any) => e.date <= filters.dateTo!)
  const income  = entries.filter((e: any) => e.type === 'OUT').reduce((s: number, e: any) => s + e.amount, 0)
  const expense = entries.filter((e: any) => e.type !== 'OUT').reduce((s: number, e: any) => s + e.amount, 0)
  return { entries, income, expense, net: income - expense }
}

export async function deleteCashbookEntry(id: string, siteId: string) {
  const [existing] = await db.select().from(cashbookEntries).where(eq(cashbookEntries.id, id))
  if (!existing) return { error: 'Entry not found' }
  const session = await requireBookAccess(existing.cashbookId)
  if (!session) return { error: 'Forbidden' }
  await db.delete(cashbookEntries).where(eq(cashbookEntries.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

// ── Parties CRUD ──────────────────────────────────────────────

export async function getParties(cashbookId: string) {
  const session = await requireBookAccess(cashbookId)
  if (!session) return []
  return db.select().from(parties).where(eq(parties.cashbookId, cashbookId)).orderBy(parties.name)
}

export async function createParty(cashbookId: string, siteId: string, name: string, type?: string, phone?: string) {
  const session = await requireBookAccess(cashbookId)
  if (!session) return { error: 'Forbidden' }
  if (!name?.trim()) return { error: 'Party name is required' }
  const id = crypto.randomUUID()
  await db.insert(parties).values({ id, siteId, cashbookId, name: name.trim(), type: type?.trim() || null, phone: phone?.trim() || null })
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, id, name: name.trim() }
}

export async function updateParty(id: string, name: string, type: string, phone: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const [existing] = await db.select().from(parties).where(eq(parties.id, id))
  if (!existing) return { error: 'Party not found' }
  const newName = name.trim()
  await db.update(parties).set({ name: newName, type: type?.trim() || null, phone: phone?.trim() || null }).where(eq(parties.id, id))
  if (existing.name !== newName) {
    await db.update(cashbookEntries).set({ partyName: newName })
      .where(and(eq(cashbookEntries.cashbookId, existing.cashbookId), eq(cashbookEntries.partyName, existing.name)))
  }
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

export async function deleteParty(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const [existing] = await db.select().from(parties).where(eq(parties.id, id))
  if (!existing) return { error: 'Party not found' }
  await db.delete(parties).where(eq(parties.id, id))
  await db.update(cashbookEntries).set({ partyName: null })
    .where(and(eq(cashbookEntries.cashbookId, existing.cashbookId), eq(cashbookEntries.partyName, existing.name)))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

// ── Categories (plain text on entries, propagate rename/delete) ─

export async function renameCategory(cashbookId: string, oldName: string, newName: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (!newName?.trim()) return { error: 'Category name is required' }
  await db.update(cashbookEntries).set({ category: newName.trim() })
    .where(and(eq(cashbookEntries.cashbookId, cashbookId), eq(cashbookEntries.category, oldName)))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

export async function deleteCategory(cashbookId: string, name: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.update(cashbookEntries).set({ category: null })
    .where(and(eq(cashbookEntries.cashbookId, cashbookId), eq(cashbookEntries.category, name)))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

// ── Custom Fields ─────────────────────────────────────────────

export async function getCustomFields(cashbookId: string) {
  const session = await requireBookAccess(cashbookId)
  if (!session) return []
  return db.select().from(cashbookCustomFields)
    .where(eq(cashbookCustomFields.cashbookId, cashbookId))
    .orderBy(cashbookCustomFields.sortOrder)
}

export async function createCustomField(cashbookId: string, label: string, fieldType: string, options: string[], required: boolean, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const id = crypto.randomUUID()
  const existing = await db.select().from(cashbookCustomFields).where(eq(cashbookCustomFields.cashbookId, cashbookId))
  await db.insert(cashbookCustomFields).values({
    id, cashbookId, label: label.trim(), fieldType,
    options: options.length > 0 ? JSON.stringify(options) : null,
    required: required ? 1 : 0,
    sortOrder: existing.length,
  })
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, id }
}

export async function updateCustomField(id: string, label: string, fieldType: string, options: string[], required: boolean, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.update(cashbookCustomFields).set({
    label: label.trim(), fieldType,
    options: options.length > 0 ? JSON.stringify(options) : null,
    required: required ? 1 : 0,
  }).where(eq(cashbookCustomFields.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

export async function deleteCustomField(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.delete(cashbookCustomFields).where(eq(cashbookCustomFields.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

// ── Custom Payment Methods ────────────────────────────────────

export async function getCustomPaymentMethods(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  return db.select().from(customPaymentMethods).where(eq(customPaymentMethods.siteId, siteId)).orderBy(customPaymentMethods.name)
}

export async function createCustomPaymentMethod(siteId: string, name: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (!name?.trim()) return { error: 'Name required' }
  const id = crypto.randomUUID()
  await db.insert(customPaymentMethods).values({ id, siteId, name: name.trim() })
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, id, name: name.trim() }
}

export async function renameCustomPaymentMethod(id: string, newName: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (!newName?.trim()) return { error: 'Name required' }
  const [existing] = await db.select().from(customPaymentMethods).where(eq(customPaymentMethods.id, id))
  if (!existing) return { error: 'Payment mode not found' }
  const name = newName.trim()
  await db.update(customPaymentMethods).set({ name }).where(eq(customPaymentMethods.id, id))
  if (existing.name !== name) {
    await db.update(cashbookEntries).set({ paymentMode: name })
      .where(and(eq(cashbookEntries.siteId, siteId), eq(cashbookEntries.paymentMode, existing.name)))
  }
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, name }
}

export async function deleteCustomPaymentMethod(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const [existing] = await db.select().from(customPaymentMethods).where(eq(customPaymentMethods.id, id))
  await db.delete(customPaymentMethods).where(eq(customPaymentMethods.id, id))
  if (existing) {
    await db.update(cashbookEntries).set({ paymentMode: null })
      .where(and(eq(cashbookEntries.siteId, siteId), eq(cashbookEntries.paymentMode, existing.name)))
  }
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

// ── Cashbook Access (limited users) ──────────────────────────

export async function getCashbookAccessList(cashbookId: string) {
  const session = await requireAdmin()
  if (!session) return []
  return db.select({ id: cashbookAccess.id, email: cashbookAccess.email, name: cashbookAccess.name, createdAt: cashbookAccess.createdAt })
    .from(cashbookAccess).where(eq(cashbookAccess.cashbookId, cashbookId))
}

export async function createCashbookAccess(cashbookId: string, email: string, name: string, password: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (!email?.trim() || !name?.trim() || !password) return { error: 'All fields required' }
  const passwordHash = await bcrypt.hash(password, 10)
  const id = crypto.randomUUID()
  await db.insert(cashbookAccess).values({ id, cashbookId, email: email.trim().toLowerCase(), name: name.trim(), passwordHash })
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, id }
}

export async function deleteCashbookAccess(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.delete(cashbookAccess).where(eq(cashbookAccess.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

export async function getCashbookSummary(cashbookId: string) {
  const entries = await getCashbookEntries(cashbookId)
  const income  = entries.filter((e: any) => e.type === 'OUT').reduce((s: number, e: any) => s + e.amount, 0)
  const expense = entries.filter((e: any) => e.type === 'IN').reduce((s: number, e: any) => s + e.amount, 0)
  return { income, expense, net: income - expense, entries }
}
