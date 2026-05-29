'use server'
// @ts-nocheck

import { db, accounting, lpos, sites } from '@/lib/db'
import { requireSession, requireAdmin } from '@/lib/auth/session'
import { eq, desc } from 'drizzle-orm'
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
export async function getMasterDashboard() {
  const session = await requireSession()
  if (!session) return null
  const allSites      = await db.select().from(sites)
  const allAccounting = await db.select().from(accounting)
  const totalIncome   = allAccounting.filter((e: any) => e.type === 'INCOME').reduce((s: number, e: any) => s + e.amount, 0)
  const totalExpense  = allAccounting.filter((e: any) => e.type === 'EXPENSE').reduce((s: number, e: any) => s + e.amount, 0)
  const totalBudget   = allSites.reduce((s: number, site: any) => s + site.budget, 0)
  const siteSummaries = allSites.map((site: any) => {
    const acc     = allAccounting.filter((a: any) => a.siteId === site.id)
    const income  = acc.filter((e: any) => e.type === 'INCOME').reduce((s: number, e: any) => s + e.amount, 0)
    const expense = acc.filter((e: any) => e.type === 'EXPENSE').reduce((s: number, e: any) => s + e.amount, 0)
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