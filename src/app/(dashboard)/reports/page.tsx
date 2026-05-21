export const dynamic = "force-dynamic"

import { getSession } from '@/lib/auth/session'
import { ReportsView } from '@/components/charts/ReportsView'

export default async function ReportsPage() {
  const session = await getSession()
  return (
    <ReportsView isAdmin={session?.role === 'ADMIN'} />
  )
}
