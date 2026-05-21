export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getCashbookEntries } from '@/actions/cashbook'
export async function GET(_: Request, { params }: { params: { bookId: string } }) {
  const entries = await getCashbookEntries(params.bookId)
  const income  = entries.filter((e:any) => e.type === 'INCOME').reduce((s:number, e:any) => s + e.amount, 0)
  const expense = entries.filter((e:any) => e.type !== 'INCOME').reduce((s:number, e:any) => s + e.amount, 0)
  return NextResponse.json({ entries, income, expense, net: income - expense })
}
