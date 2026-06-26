'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { addCashbookEntry, updateCashbookEntry, deleteCashbookEntry, getCustomFields } from '@/actions/cashbook'
import {
  ConfirmProvider, useConfirm, EntryDrawer, fmtAmt, fmtDate, partyLabel,
  exportToExcel, exportToPDF,
} from '@/components/charts/CashbookView'

const PAGE_SIZE = 50

export function BookAccessView(props: {
  book: any; siteName?: string; initialParties: any[]; initialCustomPaymentMethods: any[]
}) {
  return <ConfirmProvider><BookAccessViewInner {...props} /></ConfirmProvider>
}

function BookAccessViewInner({ book, siteName = '', initialParties, initialCustomPaymentMethods }: {
  book: any; siteName?: string; initialParties: any[]; initialCustomPaymentMethods: any[]
}) {
  const [parties, setParties]           = useState<any[]>(initialParties)
  const [customPMs, setCustomPMs]       = useState<{ id: string; name: string }[]>(initialCustomPaymentMethods)
  const [customFields, setCustomFields] = useState<any[]>([])
  const [entries, setEntries]           = useState<any[]>([])
  const [page, setPage]                 = useState(1)
  const [filterSearch, setFilterSearch] = useState('')
  const [drawer, setDrawer]             = useState<{ open: boolean; entry?: any; type?: 'IN' | 'OUT' }>({ open: false })
  const [ok, setOk]                     = useState('')
  const [error, setError]               = useState('')
  const confirmDialog = useConfirm()

  function flash(msg: string) { setOk(msg); setTimeout(() => setOk(''), 3000) }

  async function load() {
    const [entriesRes, fields] = await Promise.all([
      fetch(`/api/cashbook/${book.id}/entries`).then(r => r.json()),
      getCustomFields(book.id),
    ])
    setEntries(entriesRes.entries ?? [])
    setCustomFields(fields ?? [])
  }

  useEffect(() => { load() }, [book.id])

  const allPaymentModes = [...new Set([...customPMs.map(m => m.name), ...entries.map((e: any) => e.paymentMode).filter(Boolean)])]
  const allCategories   = [...new Set(entries.map((e: any) => e.category).filter(Boolean))]

  const filtered = useMemo(() => entries.filter((e: any) => {
    if (filterSearch && !e.description?.toLowerCase().includes(filterSearch.toLowerCase()) && !e.partyName?.toLowerCase().includes(filterSearch.toLowerCase()) && !e.reference?.toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  }), [entries, filterSearch])

  const balanceMap = useMemo(() => {
    const map: Record<string, number> = {}
    let bal = 0
    ;[...filtered].reverse().forEach((e: any) => { bal += e.type === 'OUT' ? e.amount : -e.amount; map[e.id] = bal })
    return map
  }, [filtered])

  const income  = filtered.filter((e: any) => e.type === 'OUT').reduce((s: number, e: any) => s + e.amount, 0)
  const expense = filtered.filter((e: any) => e.type !== 'OUT').reduce((s: number, e: any) => s + e.amount, 0)
  const net     = income - expense

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleSaveEntry(data: any, addAnother = false) {
    data.cashbookId = book.id; data.siteId = book.siteId
    const r = drawer.entry
      ? await updateCashbookEntry(drawer.entry.id, data, book.siteId)
      : await addCashbookEntry(data)
    if (r?.error) { setError(r.error); return }
    flash(drawer.entry ? 'Updated!' : 'Entry added!')
    if (addAnother) setDrawer(d => ({ open: true, entry: undefined, type: d.type }))
    else setDrawer({ open: false })
    load()
  }

  async function handleDeleteEntry(id: string) {
    const okConfirm = await confirmDialog('Delete this entry?', { confirmLabel: 'Delete' })
    if (!okConfirm) return
    await deleteCashbookEntry(id, book.siteId)
    setEntries(prev => prev.filter((e: any) => e.id !== id))
    flash('Deleted')
  }

  async function handlePartyAdded(p: any) { setParties(prev => [...prev, p]) }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
        <div>
          <h1 className="font-bold text-slate-900 text-base">📒 {book.name}</h1>
          <p className="text-slate-400 text-xs">{siteName}</p>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300 font-semibold">Logout</button>
        </form>
      </div>

      {ok && <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-sm font-semibold text-center">✓ {ok}</div>}
      {error && <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-800 text-sm font-semibold text-center">{error}</div>}

      <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex-shrink-0 text-sm flex-wrap">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-slate-600">Cash In:</span><span className="font-bold text-green-700">₹{fmtAmt(income)}</span></div>
        <div className="text-slate-300">|</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-slate-600">Cash Out:</span><span className="font-bold text-red-600">₹{fmtAmt(expense)}</span></div>
        <div className="text-slate-300">|</div>
        <div className="flex items-center gap-1.5"><span className="text-slate-600">Balance:</span><span className={`font-bold ${net >= 0 ? 'text-green-700' : 'text-red-600'}`}>₹{fmtAmt(Math.abs(net))}</span></div>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => exportToExcel(filtered, book.name, parties, siteName)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-green-700 hover:border-green-300 text-xs font-semibold transition-colors">↓ Excel</button>
          <button type="button" onClick={() => exportToPDF(filtered, book.name, { income, expense, net }, parties, siteName)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-300 text-xs font-semibold transition-colors">↓ PDF</button>
        </div>
      </div>

      <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            placeholder="Search transactions..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="text-sm text-slate-500 font-medium">
          Showing {filtered.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0} - {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} entries
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDrawer({ open: true, entry: undefined, type: 'OUT' })}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors shadow-sm">+ Cash In</button>
          <button type="button" onClick={() => setDrawer({ open: true, entry: undefined, type: 'IN' })}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow-sm">+ Cash Out</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: 700 }}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
              <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
              <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
              <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Mode</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Bill</th>
              <th className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Balance</th>
              <th className="w-20 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400 text-sm">No entries yet. Click "Cash In" or "Cash Out" to get started.</td></tr>
            ) : paginated.map((e: any) => {
              const isReceived = e.type === 'OUT'
              const bal = balanceMap[e.id] ?? 0
              return (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-3"><div className="text-xs text-slate-700 leading-relaxed">{fmtDate(e.date)}</div></td>
                  <td className="px-3 py-3 max-w-[200px]">
                    <div className="text-slate-900 font-semibold text-sm truncate">{e.description || '—'}</div>
                    {e.partyName && <div className="text-slate-500 text-xs mt-0.5">by {partyLabel(e.partyName, parties)}</div>}
                    {e.addedBy && <div className="text-slate-400 text-xs">Added by {e.addedBy}</div>}
                    {e.reference && <div className="text-slate-400 text-xs">{e.reference}</div>}
                  </td>
                  <td className="px-3 py-3">{e.category ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">{e.category}</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-3 text-slate-600 text-sm">{e.paymentMode || '—'}</td>
                  <td className="px-3 py-3 text-center">
                    {e.proofUrl ? (
                      <a href={e.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors" title="View proof">
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      </a>
                    ) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right"><span className={`font-bold text-sm ${isReceived ? 'text-green-700' : 'text-red-600'}`}>{isReceived ? '' : '-'}₹{fmtAmt(e.amount)}</span></td>
                  <td className="px-3 py-3 text-right"><span className={`font-semibold text-sm ${bal >= 0 ? 'text-green-700' : 'text-red-600'}`}>₹{fmtAmt(bal)}</span></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button type="button" onClick={() => setDrawer({ open: true, entry: e, type: e.type })} title="Edit"
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button type="button" onClick={() => handleDeleteEntry(e.id)} title="Delete"
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-slate-200 bg-white flex-shrink-0">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 disabled:opacity-40">Prev</button>
          <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 disabled:opacity-40">Next</button>
        </div>
      )}

      <EntryDrawer
        open={drawer.open} onClose={() => setDrawer({ open: false })} siteId={book.siteId} cashbookId={book.id}
        initialData={drawer.entry} entryType={drawer.type ?? 'OUT'} customFields={customFields}
        allPaymentModes={allPaymentModes} allCategories={allCategories} parties={parties}
        onPartyAdded={handlePartyAdded} onSave={handleSaveEntry}
      />
    </div>
  )
}
