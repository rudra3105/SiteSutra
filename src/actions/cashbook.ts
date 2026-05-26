'use server'
// @ts-nocheck

import { db, cashbooks, cashbookEntries, parties, cashbookCustomFields, customPaymentMethods, cashbookAccess } from '@/lib/db'
import { requireSession, requireAdmin } from '@/lib/auth/session'
import { eq, desc, and, gte, lte } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

// ── Cashbooks CRUD ─────────────────────────────────────────────

export async function createCashbook(siteId: string, name: string, description?: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const id = crypto.randomUUID()
  await db.insert(cashbooks).values({ id, siteId, name: name.trim(), description: description?.trim() || null })
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, id }
}

export async function getCashbooks(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  return db.select().from(cashbooks).where(eq(cashbooks.siteId, siteId)).orderBy(cashbooks.createdAt)
}

export async function updateCashbook(id: string, name: string, description: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.update(cashbooks).set({ name: name.trim(), description: description?.trim() || null, updatedAt: new Date().toISOString() }).where(eq(cashbooks.id, id))
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
  const session = await requireAdmin()
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
  })
  revalidatePath(`/sites/${data.siteId as string}/accounting`)
  return { success: true, id }
}

export async function updateCashbookEntry(id: string, data: Record<string, unknown>, siteId: string) {
  const session = await requireAdmin()
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
  const session = await requireSession()
  if (!session) return []
  return db.select().from(cashbookEntries)
    .where(eq(cashbookEntries.cashbookId, cashbookId))
    .orderBy(desc(cashbookEntries.date))
}

export async function deleteCashbookEntry(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.delete(cashbookEntries).where(eq(cashbookEntries.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

// ── Parties CRUD ──────────────────────────────────────────────

export async function getParties(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  return db.select().from(parties).where(eq(parties.siteId, siteId)).orderBy(parties.name)
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

export async function updateParty(id: string, name: string, type: string, phone: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.update(parties).set({ name: name.trim(), type: type?.trim() || null, phone: phone?.trim() || null }).where(eq(parties.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

export async function deleteParty(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.delete(parties).where(eq(parties.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

// ── Custom Fields ─────────────────────────────────────────────

export async function getCustomFields(cashbookId: string) {
  const session = await requireSession()
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

export async function deleteCustomPaymentMethod(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.delete(customPaymentMethods).where(eq(customPaymentMethods.id, id))
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
