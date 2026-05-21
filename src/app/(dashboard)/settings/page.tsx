export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { getAllUsers } from '@/actions/users'
import { getSites } from '@/actions/sites'
import { db, workTypes, materials } from '@/lib/db'
import { SettingsView } from '@/components/charts/SettingsView'

export default async function SettingsPage() {
  const session = await getSession()
  if (session?.role !== 'ADMIN') redirect('/dashboard')

  const [users, sites, allWorkTypes, allMaterials] = await Promise.all([
    getAllUsers(),
    getSites(),
    db.select().from(workTypes),
    db.select().from(materials),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-slate-600 text-sm">User management, site access & ideal rules</p>
      </div>
      <SettingsView
        users={users as any}
        sites={sites as any}
        workTypes={allWorkTypes}
        materials={allMaterials}
      />
    </div>
  )
}
