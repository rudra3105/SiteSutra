'use client'
import { useState } from 'react'

export function MaterialSiteView({ materials, variance }: { materials: any[]; variance: any[] }) {
  const [tab, setTab] = useState<'stock'|'variance'>('stock')
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['stock','variance'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab===t ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}>
            {t==='stock' ? 'Stock Levels' : 'Ideal vs Actual'}
          </button>
        ))}
      </div>

      {tab==='stock' && (
        <div className="space-y-2">
          {materials.length===0 && <p className="text-slate-600 text-sm text-center py-8">No materials added yet.</p>}
          {materials.map((m:any) => {
            const purchased = m.purchased ?? 0
            const used      = m.used      ?? 0
            const stock     = m.stock     ?? 0
            const pct       = purchased > 0 ? Math.min(100,Math.round((used/purchased)*100)) : 0
            const stockColor = stock < 0 ? 'text-red-700' : stock < 10 ? 'text-amber-700' : 'text-emerald-700'
            return (
              <div key={m.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-slate-900 font-bold text-sm">{m.name}</h4>
                    <span className="text-slate-600 text-xs">{m.unit}</span>
                  </div>
                  <span className={`font-bold text-lg ${stockColor}`}>{stock.toFixed(1)} <span className="text-xs font-normal text-slate-600">{m.unit}</span></span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-center mb-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <div className="text-blue-800 font-bold text-sm">{purchased.toFixed(1)}</div>
                    <div className="text-blue-700">Purchased</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                    <div className="text-orange-800 font-bold text-sm">{used.toFixed(1)}</div>
                    <div className="text-orange-700">Used</div>
                  </div>
                  <div className={`rounded-lg p-2 border ${stock<0?'bg-red-50 border-red-200':'bg-emerald-50 border-emerald-200'}`}>
                    <div className={`font-bold text-sm ${stockColor}`}>{stock.toFixed(1)}</div>
                    <div className={stock<0?'text-red-700':'text-emerald-700'}>Balance</div>
                  </div>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct>90?'bg-red-500':pct>70?'bg-amber-500':'bg-blue-500'}`} style={{width:`${pct}%`}} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab==='variance' && (
        <div className="space-y-2">
          {variance.length===0 && <p className="text-slate-600 text-sm text-center py-8">No ideal rules configured yet. Add them in Settings.</p>}
          {variance.map((v:any, i:number) => {
            const vPct   = v.variancePercent ?? 0
            const isOver = vPct > 0
            const alert  = Math.abs(vPct) > 5
            return (
              <div key={i} className={`card p-4 ${alert?'border-amber-300':''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-slate-900 font-bold text-sm">{v.materialName}</h4>
                    <p className="text-slate-600 text-xs">For: {v.workTypeName} · {v.totalWork} {v.workUnit} done</p>
                  </div>
                  <span className={`badge ${alert?(isOver?'badge-red':'badge-yellow'):'badge-green'}`}>
                    {vPct>0?'+':''}{vPct.toFixed(1)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
                    <div className="text-emerald-800 font-bold text-sm">{(v.idealQty??0).toFixed(2)} {v.unit}</div>
                    <div className="text-emerald-700">Ideal</div>
                  </div>
                  <div className={`rounded-lg p-2 text-center border ${alert&&isOver?'bg-red-50 border-red-200':'bg-slate-50 border-slate-200'}`}>
                    <div className={`font-bold text-sm ${alert&&isOver?'text-red-800':'text-slate-800'}`}>{(v.actualQty??0).toFixed(2)} {v.unit}</div>
                    <div className={alert&&isOver?'text-red-700':'text-slate-600'}>Actual</div>
                  </div>
                </div>
                {alert && <p className="text-amber-800 text-xs mt-2 font-medium">⚠ {isOver?`${Math.abs(vPct).toFixed(1)}% over-consumption`:`${Math.abs(vPct).toFixed(1)}% under-consumption`}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
