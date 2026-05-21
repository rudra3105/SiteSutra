// @ts-nocheck
export const dynamic = 'force-dynamic'

import { getWorkLogs } from '@/actions/worklogs'
import { getLabourBySite } from '@/actions/labour'
import { getMaterialsBySite } from '@/actions/materials'
import { getFinancialSummary } from '@/actions/accounting'
import { getSession } from '@/lib/auth/session'
import { db, workTypes } from '@/lib/db'
import { eq } from 'drizzle-orm'
import Link from 'next/link'

function inr(n: number) {
  if (n >= 10000000) return '\u20b9' + (n / 10000000).toFixed(1) + 'Cr'
  if (n >= 100000)   return '\u20b9' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)     return '\u20b9' + (n / 1000).toFixed(0) + 'K'
  return '\u20b9' + n.toFixed(0)
}

export default async function SiteOverviewPage({ params }: any) {
  const session = await getSession()
  const isAdmin = session?.role === 'ADMIN'
  const { siteId } = params

  const [recentLogs, workers, materials, siteWorkTypes] = await Promise.all([
    getWorkLogs(siteId),
    getLabourBySite(siteId),
    getMaterialsBySite(siteId),
    db.select().from(workTypes).where(eq(workTypes.siteId, siteId)),
  ])

  const financials = isAdmin ? await getFinancialSummary(siteId) : null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Site Overview</h2>
        <p className="text-slate-600 text-sm">Summary of all activity on this site</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Work Types</p>
          <p className="text-2xl font-bold text-orange-600">{siteWorkTypes.length}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Workers</p>
          <p className="text-2xl font-bold text-blue-600">{workers.length}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Materials</p>
          <p className="text-2xl font-bold text-emerald-600">{materials.length}</p>
        </div>
        {financials ? (
          <div className="card p-4 text-center">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Net P&L</p>
            <p className={`text-2xl font-bold ${financials.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {financials.net >= 0 ? '+' : ''}{inr(financials.net)}
            </p>
          </div>
        ) : (
          <div className="card p-4 text-center">
            <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Work Logs</p>
            <p className="text-2xl font-bold text-slate-800">{recentLogs.length}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: `/sites/${siteId}/worklogs`, label: 'Work Logs', icon: '📋' },
          { href: `/sites/${siteId}/labour`,   label: 'Attendance', icon: '👷' },
          { href: `/sites/${siteId}/materials`,label: 'Materials', icon: '🧱' },
          ...(isAdmin ? [{ href: `/sites/${siteId}/accounting`, label: 'Accounting', icon: '💰' }] : []),
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="card p-4 flex flex-col items-center gap-2 text-center hover:border-orange-300 hover:shadow-md transition-all">
            <span className="text-2xl">{item.icon}</span>
            <span className="text-slate-800 text-xs font-semibold">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 text-sm">Recent Work Logs</h3>
            <Link href={`/sites/${siteId}/worklogs`} className="text-orange-600 text-xs font-semibold hover:underline">View all &rarr;</Link>
          </div>
          {recentLogs.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No work logs yet</p>
          ) : recentLogs.slice(0, 5).map((log: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div>
                <p className="text-slate-900 text-sm font-semibold">{log.workType?.name ?? 'Work'}</p>
                <p className="text-slate-500 text-xs">{log.date}</p>
              </div>
              <span className="text-orange-700 font-bold text-sm">{(log.quantity ?? 0).toFixed(1)} {log.workType?.unit ?? log.unit ?? ''}</span>
            </div>
          ))}
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 text-sm">Material Stock</h3>
            <Link href={`/sites/${siteId}/materials`} className="text-orange-600 text-xs font-semibold hover:underline">View all &rarr;</Link>
          </div>
          {materials.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No materials added yet</p>
          ) : materials.slice(0, 5).map((m: any) => {
            const pct = m.purchased > 0 ? Math.min(100, Math.round((m.used / m.purchased) * 100)) : 0
            const sc = m.stock < 0 ? 'text-red-600' : m.stock < 10 ? 'text-amber-600' : 'text-emerald-600'
            return (
              <div key={m.id} className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-800 text-xs font-semibold">{m.name}</span>
                  <span className={'text-xs font-bold ' + sc}>{m.stock.toFixed(1)} {m.unit}</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={'h-full rounded-full ' + (pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{width: pct + '%'}} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 text-sm">Workers</h3>
            <Link href={`/sites/${siteId}/labour`} className="text-orange-600 text-xs font-semibold hover:underline">View all &rarr;</Link>
          </div>
          {workers.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No workers added yet</p>
          ) : workers.slice(0, 5).map((w: any) => (
            <div key={w.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 font-bold text-xs">{w.name[0]}</span>
                </div>
                <div>
                  <p className="text-slate-900 text-xs font-semibold">{w.name}</p>
                  <p className="text-slate-500 text-xs">{w.trade}</p>
                </div>
              </div>
              <span className="text-slate-700 text-xs font-medium">{'\u20b9'}{w.dailyWage}/day</span>
            </div>
          ))}
        </div>

        {financials && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Financials</h3>
              <Link href={`/sites/${siteId}/accounting`} className="text-orange-600 text-xs font-semibold hover:underline">View all &rarr;</Link>
            </div>
            <div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 text-sm">Income</span>
                <span className="text-emerald-700 font-bold">{inr(financials.income)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 text-sm">Expenses</span>
                <span className="text-red-700 font-bold">{inr(financials.expense)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-900 font-semibold text-sm">Net P&L</span>
                <span className={'font-bold text-lg ' + (financials.net >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                  {financials.net >= 0 ? '+' : ''}{inr(financials.net)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
