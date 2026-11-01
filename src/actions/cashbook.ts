'use server'
// @ts-nocheck

import { db, cashbooks, cashbookEntries, parties, cashbookCustomFields, customPaymentMethods, customCategories, cashbookSupervisors, users, siteAccess } from '@/lib/db'
import { requireSession, requireAdmin } from '@/lib/auth/session'
import { eq, desc, and, gte, lte } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function hasSiteAccess(userId: string, siteId: string) {
  const [row] = await db.select({ id: siteAccess.id }).from(siteAccess)
    .where(and(eq(siteAccess.userId, userId), eq(siteAccess.siteId, siteId)))
  return !!row
}

// A supervisor needs BOTH site permission for the book's site and a grant for
// that book from an admin (picked in the book's Access popup).
async function requireBookAccess(cashbookId: string) {
  const session = await requireSession()
  if (!session) return null
  if (session.role === 'ADMIN') return session
  if (session.role === 'SUPERVISOR') {
    const [book] = await db.select({ siteId: cashbooks.siteId, isAdminBook: cashbooks.isAdminBook }).from(cashbooks).where(eq(cashbooks.id, cashbookId))
    if (!book || book.isAdminBook || !(await hasSiteAccess(session.userId, book.siteId))) return null
    const [grant] = await db.select({ id: cashbookSupervisors.id }).from(cashbookSupervisors)
      .where(and(eq(cashbookSupervisors.cashbookId, cashbookId), eq(cashbookSupervisors.userId, session.userId)))
    if (grant) return session
  }
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
  const books = await db.select().from(cashbooks).where(eq(cashbooks.siteId, siteId))
    .orderBy(desc(cashbooks.isAdminBook), cashbooks.createdAt)
  if (session.role === 'ADMIN') return books
  // Supervisors: site permission first, then only the books granted to them
  if (!(await hasSiteAccess(session.userId, siteId))) return []
  const grants = await db.select({ cashbookId: cashbookSupervisors.cashbookId }).from(cashbookSupervisors)
    .where(eq(cashbookSupervisors.userId, session.userId))
  const allowed = new Set(grants.map((g: any) => g.cashbookId))
  return books.filter((b: any) => allowed.has(b.id) && !b.isAdminBook)
}

// ── Book sharing with supervisors (admin only) ────────────────

// For the book's Access popup: `granted` = users who have this book (with whether
// they still hold site permission), `available` = supervisors with permission for
// the book's site who don't have the book yet — the only users an admin can pick.
export async function getBookSupervisors(cashbookId: string) {
  const empty = { granted: [], available: [] }
  const session = await requireAdmin()
  if (!session) return empty
  const [book] = await db.select().from(cashbooks).where(eq(cashbooks.id, cashbookId))
  if (!book) return empty
  const siteUsers = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(siteAccess).innerJoin(users, eq(siteAccess.userId, users.id))
    .where(eq(siteAccess.siteId, book.siteId))
  const onSite = new Set(siteUsers.map((u: any) => u.id))
  const grants = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(cashbookSupervisors).innerJoin(users, eq(cashbookSupervisors.userId, users.id))
    .where(eq(cashbookSupervisors.cashbookId, cashbookId))
  const grantedIds = new Set(grants.map((g: any) => g.id))
  return {
    granted: grants.map((u: any) => ({ ...u, hasSiteAccess: onSite.has(u.id) })),
    available: siteUsers.filter((u: any) => u.role === 'SUPERVISOR' && !grantedIds.has(u.id))
      .map((u: any) => ({ id: u.id, name: u.name, email: u.email })),
  }
}

export async function setBookSupervisor(cashbookId: string, userId: string, granted: boolean, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (granted) {
    // Only supervisors who already have permission for the book's site can be given the book
    const [book] = await db.select({ siteId: cashbooks.siteId, isAdminBook: cashbooks.isAdminBook }).from(cashbooks).where(eq(cashbooks.id, cashbookId))
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
    if (book?.isAdminBook) return { error: 'The Admin Book is for admins only' }
    if (!book || user?.role !== 'SUPERVISOR') return { error: 'Only supervisors can be given book access' }
    if (!(await hasSiteAccess(userId, book.siteId))) return { error: 'This user has no permission for this site' }
    await db.insert(cashbookSupervisors).values({ id: crypto.randomUUID(), cashbookId, userId }).onConflictDoNothing()
  } else {
    await db.delete(cashbookSupervisors)
      .where(and(eq(cashbookSupervisors.cashbookId, cashbookId), eq(cashbookSupervisors.userId, userId)))
  }
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

export async function updateCashbook(id: string, name: string, description: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  await db.update(cashbooks).set({ name: name.trim(), description: description?.trim() || null }).where(eq(cashbooks.id, id))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true }
}

// ── Admin Book (one per site; source of the site Overview's Net P&L) ─

const ADMIN_BOOK_NAME = 'Admin Book'

// Returns the site's Admin Book id, creating the book if the site doesn't have one yet
export async function ensureAdminBook(siteId: string) {
  const session = await requireAdmin()
  if (!session) return null
  const [existing] = await db.select({ id: cashbooks.id }).from(cashbooks)
    .where(and(eq(cashbooks.siteId, siteId), eq(cashbooks.isAdminBook, 1)))
  if (existing) return existing.id
  const id = crypto.randomUUID()
  await db.insert(cashbooks).values({ id, siteId, name: ADMIN_BOOK_NAME, description: 'Net P&L for this site is calculated from this book', isAdminBook: 1 })
  return id
}

// Cash In / Cash Out / Net of the Admin Book only (entry type 'OUT' = Cash In, 'IN' = Cash Out)
export async function getAdminBookSummary(siteId: string) {
  const session = await requireAdmin()
  if (!session) return null
  const bookId = await ensureAdminBook(siteId)
  const entries = await db.select({ type: cashbookEntries.type, amount: cashbookEntries.amount })
    .from(cashbookEntries).where(eq(cashbookEntries.cashbookId, bookId))
  const income  = entries.filter((e: any) => e.type === 'OUT').reduce((s: number, e: any) => s + e.amount, 0)
  const expense = entries.filter((e: any) => e.type === 'IN').reduce((s: number, e: any) => s + e.amount, 0)
  return { income, expense, net: income - expense }
}

export async function deleteCashbook(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const [book] = await db.select({ isAdminBook: cashbooks.isAdminBook }).from(cashbooks).where(eq(cashbooks.id, id))
  if (book?.isAdminBook) return { error: "The Admin Book can't be deleted — the site's Net P&L is calculated from it" }
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
  // Only admins can change or remove an entry; book-access users can add and view only
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
  const session = await requireBookAccess(cashbookId)
  if (!session) return []
  return db.select().from(cashbookEntries)
    .where(eq(cashbookEntries.cashbookId, cashbookId))
    .orderBy(desc(cashbookEntries.date), desc(cashbookEntries.createdAt))
}

export async function getAllEntriesBySite(siteId: string, filters?: {
  category?: string; type?: string; party?: string; dateFrom?: string; dateTo?: string
}) {
  const session = await requireAdmin()
  if (!session) return { entries: [], income: 0, expense: 0, net: 0 }
  const { inArray } = await import('drizzle-orm')
  const books = await db.select().from(cashbooks).where(eq(cashbooks.siteId, siteId))
  if (!books.length) return { entries: [], income: 0, expense: 0, net: 0 }
  const bookIds = books.map((b: any) => b.id)
  const bookMap: Record<string, string> = {}
  books.forEach((b: any) => { bookMap[b.id] = b.name })
  let entries: any[] = await db.select().from(cashbookEntries)
    .where(inArray(cashbookEntries.cashbookId, bookIds))
    .orderBy(desc(cashbookEntries.date), desc(cashbookEntries.createdAt))
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

export async function getSiteCategories(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  const { inArray } = await import('drizzle-orm')
  const books = await db.select({ id: cashbooks.id }).from(cashbooks).where(eq(cashbooks.siteId, siteId))
  if (!books.length) return []
  const bookIds = books.map((b: any) => b.id)
  const rows = await db.select({ category: cashbookEntries.category }).from(cashbookEntries)
    .where(inArray(cashbookEntries.cashbookId, bookIds))
  const cats = [...new Set(rows.map((r: any) => r.category).filter(Boolean))] as string[]
  cats.sort((a, b) => a.localeCompare(b))
  return cats
}

export async function deleteCashbookEntry(id: string, siteId: string) {
  const [existing] = await db.select().from(cashbookEntries).where(eq(cashbookEntries.id, id))
  if (!existing) return { error: 'Entry not found' }
  // Only admins can change or remove an entry; book-access users can add and view only
  const session = await requireAdmin()
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
  const session = await requireAdmin()
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

// ── Categories (central site-wide list; entries store the name as text) ─

// Adds any name used on the site's entries but missing from `table`, so values
// saved before the central list existed still show up and can be managed there.
async function backfillSiteOptions(siteId: string, table: any, entryCol: any) {
  const rows = await db.select({ v: entryCol }).from(cashbookEntries).where(eq(cashbookEntries.siteId, siteId))
  const existing = await db.select({ name: table.name }).from(table).where(eq(table.siteId, siteId))
  const known = new Set(existing.map((r: any) => r.name.toLowerCase()))
  for (const name of new Set(rows.map((r: any) => r.v?.trim()).filter(Boolean)) as Set<string>) {
    if (known.has(name.toLowerCase())) continue
    known.add(name.toLowerCase())
    await db.insert(table).values({ id: crypto.randomUUID(), siteId, name })
  }
}

export async function getCustomCategories(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  await backfillSiteOptions(siteId, customCategories, cashbookEntries.category)
  return db.select().from(customCategories).where(eq(customCategories.siteId, siteId)).orderBy(customCategories.name)
}

export async function createCustomCategory(siteId: string, name: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (!name?.trim()) return { error: 'Category name is required' }
  const existing = await db.select().from(customCategories).where(eq(customCategories.siteId, siteId))
  const dup = existing.find((c: any) => c.name.toLowerCase() === name.trim().toLowerCase())
  if (dup) return { success: true, id: dup.id, name: dup.name }
  const id = crypto.randomUUID()
  await db.insert(customCategories).values({ id, siteId, name: name.trim() })
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, id, name: name.trim() }
}

export async function renameCustomCategory(id: string, newName: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (!newName?.trim()) return { error: 'Category name is required' }
  const [existing] = await db.select().from(customCategories).where(eq(customCategories.id, id))
  if (!existing) return { error: 'Category not found' }
  const name = newName.trim()
  await db.update(customCategories).set({ name }).where(eq(customCategories.id, id))
  if (existing.name !== name) {
    await db.update(cashbookEntries).set({ category: name })
      .where(and(eq(cashbookEntries.siteId, siteId), eq(cashbookEntries.category, existing.name)))
  }
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, name }
}

export async function deleteCustomCategory(id: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const [existing] = await db.select().from(customCategories).where(eq(customCategories.id, id))
  await db.delete(customCategories).where(eq(customCategories.id, id))
  if (existing) {
    await db.update(cashbookEntries).set({ category: null })
      .where(and(eq(cashbookEntries.siteId, siteId), eq(cashbookEntries.category, existing.name)))
  }
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

// ── Custom dropdown field options (managed one value at a time) ─

async function getDropdownField(fieldId: string) {
  const [field] = await db.select().from(cashbookCustomFields).where(eq(cashbookCustomFields.id, fieldId))
  if (!field) return null
  return { field, options: (field.options ? JSON.parse(field.options) : []) as string[] }
}

// Rewrites this field's value on every entry of its book that currently holds `from`.
async function replaceCustomFieldValue(field: any, from: string, to: string | null) {
  const rows = await db.select({ id: cashbookEntries.id, v: cashbookEntries.customFieldValues })
    .from(cashbookEntries).where(eq(cashbookEntries.cashbookId, field.cashbookId))
  for (const r of rows) {
    if (!r.v) continue
    const vals = typeof r.v === 'string' ? JSON.parse(r.v) : r.v
    if (vals[field.id] !== from) continue
    if (to === null) delete vals[field.id]; else vals[field.id] = to
    await db.update(cashbookEntries).set({ customFieldValues: JSON.stringify(vals) }).where(eq(cashbookEntries.id, r.id))
  }
}

export async function addCustomFieldOption(fieldId: string, name: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (!name?.trim()) return { error: 'Name required' }
  const f = await getDropdownField(fieldId)
  if (!f) return { error: 'Field not found' }
  const dup = f.options.find(o => o.toLowerCase() === name.trim().toLowerCase())
  if (dup) return { success: true, name: dup }
  await db.update(cashbookCustomFields).set({ options: JSON.stringify([...f.options, name.trim()]) })
    .where(eq(cashbookCustomFields.id, fieldId))
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, name: name.trim() }
}

export async function renameCustomFieldOption(fieldId: string, oldName: string, newName: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (!newName?.trim()) return { error: 'Name required' }
  const f = await getDropdownField(fieldId)
  if (!f) return { error: 'Field not found' }
  const name = newName.trim()
  await db.update(cashbookCustomFields).set({ options: JSON.stringify(f.options.map(o => o === oldName ? name : o)) })
    .where(eq(cashbookCustomFields.id, fieldId))
  if (oldName !== name) await replaceCustomFieldValue(f.field, oldName, name)
  revalidatePath(`/sites/${siteId}/accounting`)
  return { success: true, name }
}

export async function deleteCustomFieldOption(fieldId: string, name: string, siteId: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const f = await getDropdownField(fieldId)
  if (!f) return { error: 'Field not found' }
  await db.update(cashbookCustomFields).set({ options: JSON.stringify(f.options.filter(o => o !== name)) })
    .where(eq(cashbookCustomFields.id, fieldId))
  await replaceCustomFieldValue(f.field, name, null)
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
  await backfillSiteOptions(siteId, customPaymentMethods, cashbookEntries.paymentMode)
  return db.select().from(customPaymentMethods).where(eq(customPaymentMethods.siteId, siteId)).orderBy(customPaymentMethods.name)
}

export async function createCustomPaymentMethod(siteId: string, name: string) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  if (!name?.trim()) return { error: 'Name required' }
  const existing = await db.select().from(customPaymentMethods).where(eq(customPaymentMethods.siteId, siteId))
  const dup = existing.find((m: any) => m.name.toLowerCase() === name.trim().toLowerCase())
  if (dup) return { success: true, id: dup.id, name: dup.name }
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

export async function getCashbookSummary(cashbookId: string) {
  const entries = await getCashbookEntries(cashbookId)
  const income  = entries.filter((e: any) => e.type === 'OUT').reduce((s: number, e: any) => s + e.amount, 0)
  const expense = entries.filter((e: any) => e.type === 'IN').reduce((s: number, e: any) => s + e.amount, 0)
  return { income, expense, net: income - expense, entries }
}
