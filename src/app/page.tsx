import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export default async function HomePage() {
  const session = await getSession()
  if (session?.role === 'CASHBOOK_ACCESS') redirect(`/book/${session.cashbookId}`)
  if (session) redirect('/dashboard')
  redirect('/login')
}
