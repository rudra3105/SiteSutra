'use server'
// @ts-nocheck

import { db, accounting, lpos, sites, cashbooks, cashbookEntries } from '@/lib/db'
import { ensureAdminBook } from '@/actions/cashbook'
import { requireSession, requireAdmin } from '@/lib/auth/session'
import { eq, desc, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const accountingSchema = z.object({
  siteId:      z.string(),
  type:        z.enum(['INCOME', 'EXPENSE']),
  category:    z.string().min(1),
  amount:      z.coerce.number().positive(),
  description: z.string().min(1),
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'NEFT', 'RTGS', 'CHEQUE']),
  reference:   z.string().optional(),
  date:        z.string().optional(),
  invoiceNo:   z.string().optional(),
  lpoId:       z.string().optional(),
})

const lpoSchema = z.object({
  siteId:      z.string(),
  lpoNumber:   z.string().min(1),
  vendor:      z.string().min(1),
  description: z.string().min(1),
  amount:      z.coerce.number().positive(),
  status:      z.enum(['PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED']).default('PENDING'),
  issueDate:   z.string().optional(),
  dueDate:     z.string().optional(),
})

export async function createAccountingEntry(data: Record<string, unknown>) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const parsed = accountingSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.errors[0].message }
  const id = crypto.randomUUID()
  await db.insert(accounting).values({ id, ...parsed.data, date: parsed.data.date || new Date().toISOString().split('T')[0] })
  revalidatePath(`/sites/${parsed.data.siteId}/accounting`)
  return { success: true, id }
}

export async function getAccountingBySite(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  return db.select().from(accounting).where(eq(accounting.siteId, siteId)).orderBy(desc(accounting.date))
}

// Returns: { income, expense, net, byCategory }
export async function getFinancialSummary(siteId: string) {
  const session = await requireSession()
  if (!session) return null
  const entries = await db.select().from(accounting).where(eq(accounting.siteId, siteId))
  const income  = entries.filter((e: any) => e.type === 'INCOME').reduce((s: number, e: any) => s + e.amount, 0)
  const expense = entries.filter((e: any) => e.type === 'EXPENSE').reduce((s: number, e: any) => s + e.amount, 0)

  // Group by category
  const byCategory: Record<string, { income: number; expense: number }> = {}
  for (const e of entries) {
    if (!byCategory[e.category]) byCategory[e.category] = { income: 0, expense: 0 }
    if (e.type === 'INCOME')  byCategory[e.category].income  += e.amount
    if (e.type === 'EXPENSE') byCategory[e.category].expense += e.amount
  }

  return { income, expense, net: income - expense, byCategory }
}

// Returns: { totalSites, activeSites, totalBudget, totalIncome, totalExpense, netAmount, siteSummaries[] }
// Totals across sites come only from each site's Admin Book (Cash In = entry type 'OUT',
// Cash Out = 'IN'), the same source as the site Overview's Net P&L.
export async function getMasterDashboard() {
  const session = await requireAdmin()
  if (!session) return null
  const allSites = await db.select().from(sites)
  for (const site of allSites) await ensureAdminBook(site.id)
  const adminBooks = await db.select({ id: cashbooks.id, siteId: cashbooks.siteId }).from(cashbooks).where(eq(cashbooks.isAdminBook, 1))
  const bookSite: Record<string, string> = Object.fromEntries(adminBooks.map((b: any) => [b.id, b.siteId]))
  const entries = adminBooks.length
    ? await db.select({ cashbookId: cashbookEntries.cashbookId, type: cashbookEntries.type, amount: cashbookEntries.amount })
        .from(cashbookEntries).where(inArray(cashbookEntries.cashbookId, adminBooks.map((b: any) => b.id)))
    : []
  const sum = (list: any[], type: string) => list.filter((e: any) => e.type === type).reduce((s: number, e: any) => s + e.amount, 0)
  const totalIncome  = sum(entries, 'OUT')
  const totalExpense = sum(entries, 'IN')
  const totalBudget  = allSites.reduce((s: number, site: any) => s + site.budget, 0)
  const siteSummaries = allSites.map((site: any) => {
    const own     = entries.filter((e: any) => bookSite[e.cashbookId] === site.id)
    const income  = sum(own, 'OUT')
    const expense = sum(own, 'IN')
    return { ...site, income, expense, net: income - expense }
  })
  return { totalSites: allSites.length, activeSites: allSites.filter((s: any) => s.status === 'ACTIVE').length, totalBudget, totalIncome, totalExpense, netAmount: totalIncome - totalExpense, siteSummaries }
}

export async function createLPO(data: Record<string, unknown>) {
  const session = await requireAdmin()
  if (!session) return { error: 'Forbidden' }
  const parsed = lpoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.errors[0].message }
  const id = crypto.randomUUID()
  await db.insert(lpos).values({ id, ...parsed.data, issueDate: parsed.data.issueDate || new Date().toISOString().split('T')[0] })
  revalidatePath(`/sites/${parsed.data.siteId}/accounting`)
  return { success: true, id }
}

export async function getLPOs(siteId: string) {
  const session = await requireSession()
  if (!session) return []
  return db.select().from(lpos).where(eq(lpos.siteId, siteId)).orderBy(desc(lpos.issueDate))
}