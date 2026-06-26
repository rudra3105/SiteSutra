import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { AppShell } from '@/components/layout/AppShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role === 'CASHBOOK_ACCESS') redirect(`/book/${session.cashbookId}`)
  return <AppShell session={session}>{children}</AppShell>
}
