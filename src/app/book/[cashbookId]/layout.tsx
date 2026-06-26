import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export default async function BookAccessLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { cashbookId: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN' && (session.role !== 'CASHBOOK_ACCESS' || session.cashbookId !== params.cashbookId)) {
    redirect('/login')
  }
  return <div className="min-h-screen bg-slate-100">{children}</div>
}
