'use client'
import { useState } from 'react'
import { createAccountingEntry, createLPO } from '@/actions/accounting'

function inr(n: number) {
  if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n/100000).toFixed(1)}L`
  if (n >= 1000)     return `₹${(n/1000).toFixed(0)}K`
  return `₹${n.toFixed(0)}`
}

export function AccountingView({ siteId, financials, entries, lpos }: any) {
  const [tab, setTab]         = useState<'add'|'entries'|'lpo'>('add')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [ok, setOk]           = useState('')

  function flash(msg:string){ setOk(msg); setTimeout(()=>setOk(''),3000) }

  async function handleEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const data: any = Object.fromEntries(fd)
    data.siteId = siteId
    const res = await createAccountingEntry(data)
    setLoading(false)
    if (res?.error) setError(res.error)
    else { flash('Entry saved!'); (e.target as HTMLFormElement).reset() }
  }

  async function handleLPO(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const data: any = Object.fromEntries(fd)
    data.siteId = siteId
    const res = await createLPO(data)
    setLoading(false)
    if (res?.error) setError(res.error)
    else { flash('LPO created!'); (e.target as HTMLFormElement).reset() }
  }

  const income  = financials?.income  ?? 0
  const expense = financials?.expense ?? 0
  const net     = financials?.net     ?? 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <div className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Income</div>
          <div className="text-emerald-700 font-bold text-lg">{inr(income)}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Expenses</div>
          <div className="text-red-700 font-bold text-lg">{inr(expense)}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Net P&L</div>
          <div className={`font-bold text-lg ${net>=0?'text-emerald-700':'text-red-700'}`}>{net>=0?'+':''}{inr(net)}</div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {([['add','Add Entry'],['entries','All Entries'],['lpo','LPOs']] as const).map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab===k?'bg-orange-500 text-white':'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
            {l}
          </button>
        ))}
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-800 text-sm font-medium">{error}</div>}
      {ok    && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-medium">✓ {ok}</div>}

      {tab==='add' && (
        <form onSubmit={handleEntry} className="card p-5 space-y-4">
          <h3 className="font-bold text-slate-900">New Entry</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Type *</label>
              <select name="type" className="input" required>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select></div>
            <div><label className="label">Amount (₹) *</label>
              <input name="amount" type="number" className="input" required min="1" placeholder="50000" /></div>
          </div>
          <div><label className="label">Category *</label>
            <input name="category" className="input" required placeholder="e.g. Materials, Labour, Client Payment" list="cats" />
            <datalist id="cats">{['Client Payment','Materials','Labour','Equipment','Transport','Miscellaneous'].map(c=><option key={c} value={c}/>)}</datalist>
          </div>
          <div><label className="label">Description *</label>
            <input name="description" className="input" required placeholder="Brief description..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Payment Mode *</label>
              <select name="paymentMode" className="input" required>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="CHEQUE">Cheque</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select></div>
            <div><label className="label">Date</label>
              <input name="date" type="date" className="input" defaultValue={new Date().toISOString().split('T')[0]} /></div>
          </div>
          <div><label className="label">Reference / Invoice</label>
            <input name="reference" className="input" placeholder="INV-001 (optional)" /></div>
          <button type="submit" disabled={loading} className="btn w-full disabled:opacity-60">{loading?'Saving...':'Save Entry'}</button>
        </form>
      )}

      {tab==='entries' && (
        <div className="space-y-2">
          {entries.length===0 && <p className="text-slate-600 text-sm text-center py-8">No entries yet.</p>}
          {entries.map((e:any) => (
            <div key={e.id} className="card p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-slate-900 text-sm font-bold truncate">{e.description}</p>
                <p className="text-slate-600 text-xs">{e.category} · {e.paymentMode} · {e.date}</p>
              </div>
              <span className={`font-bold text-sm flex-shrink-0 ${e.type==='INCOME'?'text-emerald-700':'text-red-700'}`}>
                {e.type==='INCOME'?'+':'-'}{inr(e.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab==='lpo' && (
        <div className="space-y-4">
          <form onSubmit={handleLPO} className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-900">New LPO</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">LPO Number *</label>
                <input name="lpoNumber" className="input" required placeholder="LPO-2024-001" /></div>
              <div><label className="label">Amount (₹) *</label>
                <input name="amount" type="number" className="input" required min="1" placeholder="100000" /></div>
            </div>
            <div><label className="label">Vendor *</label>
              <input name="vendor" className="input" required placeholder="Vendor name" /></div>
            <div><label className="label">Description *</label>
              <input name="description" className="input" required placeholder="What is being purchased..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Status</label>
                <select name="status" className="input">
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="RECEIVED">Received</option>
                </select></div>
              <div><label className="label">Issue Date</label>
                <input name="issueDate" type="date" className="input" defaultValue={new Date().toISOString().split('T')[0]} /></div>
            </div>
            <button type="submit" disabled={loading} className="btn w-full disabled:opacity-60">{loading?'Creating...':'Create LPO'}</button>
          </form>
          <div className="space-y-2">
            {lpos.map((l:any) => (
              <div key={l.id} className="card p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-slate-900 text-sm font-bold">{l.lpoNumber} — {l.vendor}</p>
                  <p className="text-slate-600 text-xs truncate">{l.description} · {l.issueDate}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-slate-900 font-bold text-sm">{inr(l.amount)}</div>
                  <span className={`badge text-xs ${l.status==='APPROVED'?'badge-green':l.status==='RECEIVED'?'badge-blue':'badge-yellow'}`}>{l.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
