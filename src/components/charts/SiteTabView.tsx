'use client'
import { useState } from 'react'
import { MaterialSiteView } from './MaterialSiteView'
import { AccountingView } from './AccountingView'

function inr(n: number) {
  if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n/100000).toFixed(1)}L`
  if (n >= 1000)     return `₹${(n/1000).toFixed(0)}K`
  return `₹${n.toFixed(0)}`
}

type Tab = 'overview'|'worklogs'|'materials'|'variance'|'financials'

export function SiteTabView({ siteId, site, recentLogs, materials, variance, financials, entries, lpos, session }: any) {
  const [tab, setTab] = useState<Tab>('overview')
  const isAdmin = session?.role === 'ADMIN'

  const tabs = [
    { key:'overview',   label:'Overview'   },
    { key:'worklogs',   label:'Work Logs'  },
    { key:'materials',  label:'Materials'  },
    { key:'variance',   label:'Variance'   },
    ...(isAdmin ? [{ key:'financials', label:'Financials' }] : []),
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
              tab===t.key ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==='overview' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Site Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-600 block text-xs font-medium">Status</span><span className="text-slate-900 font-semibold">{site.status}</span></div>
              <div><span className="text-slate-600 block text-xs font-medium">Budget</span><span className="text-orange-700 font-bold">{inr(site.budget??0)}</span></div>
              <div><span className="text-slate-600 block text-xs font-medium">Start Date</span><span className="text-slate-900">{site.startDate}</span></div>
              <div><span className="text-slate-600 block text-xs font-medium">End Date</span><span className="text-slate-900">{site.endDate??'—'}</span></div>
            </div>
            {site.description && <p className="text-slate-700 text-sm border-t border-slate-100 pt-3">{site.description}</p>}
          </div>
          <div className="card p-4">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Recent Work</h3>
            {(recentLogs??[]).length===0
              ? <p className="text-slate-600 text-sm">No work logs yet.</p>
              : (recentLogs??[]).slice(0,5).map((log:any,i:number) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <div>
                    <span className="text-slate-900 text-sm font-medium">{log.workType?.name??'Work'}</span>
                    <span className="text-slate-600 text-xs block">{log.date}</span>
                  </div>
                  <span className="text-orange-700 font-bold text-sm">{(log.quantity??0).toFixed(1)} {log.workType?.unit??log.unit??''}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {tab==='worklogs' && (
        <div className="space-y-2">
          {(recentLogs??[]).length===0 && <p className="text-slate-600 text-sm text-center py-8">No work logs yet.</p>}
          {(recentLogs??[]).map((log:any,i:number) => (
            <div key={i} className="card p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-slate-900 text-sm font-bold">{log.workType?.name??'Work'}</p>
                <p className="text-slate-600 text-xs">{log.description??''}{log.supervisor?.name ? ` · ${log.supervisor.name}` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-orange-700 font-bold text-sm">{(log.quantity??0).toFixed(1)} {log.workType?.unit??log.unit}</div>
                <div className="text-slate-600 text-xs">{log.date}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='materials' && <MaterialSiteView materials={materials??[]} variance={[]} />}
      {tab==='variance'  && <MaterialSiteView materials={[]} variance={variance??[]} />}
      {tab==='financials' && isAdmin && (
        <AccountingView siteId={siteId} financials={financials} entries={entries??[]} lpos={lpos??[]} />
      )}
    </div>
  )
}
