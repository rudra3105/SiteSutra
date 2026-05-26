'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  createCashbook, updateCashbook, deleteCashbook,
  addCashbookEntry, updateCashbookEntry, deleteCashbookEntry,
  updateParty, deleteParty,
  getCustomFields, createCustomField, updateCustomField, deleteCustomField,
  getCustomPaymentMethods, createCustomPaymentMethod, deleteCustomPaymentMethod,
  getCashbookAccessList, createCashbookAccess, deleteCashbookAccess,
} from '@/actions/cashbook'
import {
  fmt, SearchableDropdown, PartySelector, EntryForm,
  exportToCSV, exportToPDF, BASE_PAYMENT_MODES, PARTY_TYPES, FIELD_TYPES,
} from './CashbookHelpers'

// ── Main Component ────────────────────────────────────────────
export function CashbookView({ siteId, initialBooks, initialParties, initialCustomPaymentMethods }: {
  siteId: string; initialBooks: any[]; initialParties: any[]; initialCustomPaymentMethods: any[]
}) {
  const [books, setBooks]                 = useState(initialBooks)
  const [parties, setParties]             = useState(initialParties)
  const [customPMs, setCustomPMs]         = useState(initialCustomPaymentMethods)
  const [selectedBook, setSelectedBook]   = useState<string | null>(initialBooks[0]?.id ?? null)
  const [entries, setEntries]             = useState<any[]>([])
  const [customFields, setCustomFields]   = useState<any[]>([])
  const [accessList, setAccessList]       = useState<any[]>([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [ok, setOk]                       = useState('')

  // Modal states
  const [modal, setModal] = useState<
    | null
    | { type: 'newBook' }
    | { type: 'editBook'; book: any }
    | { type: 'addEntry' }
    | { type: 'editEntry'; entry: any }
    | { type: 'viewEntry'; entry: any }
    | { type: 'parties' }
    | { type: 'editParty'; party: any }
    | { type: 'customFields' }
    | { type: 'addField' }
    | { type: 'editField'; field: any }
    | { type: 'paymentMethods' }
    | { type: 'access' }
  >(null)

  // Filters
  const [filterSearch, setFilterSearch]     = useState('')
  const [filterType, setFilterType]         = useState('')
  const [filterParty, setFilterParty]       = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMode, setFilterMode]         = useState('')
  const [filterFrom, setFilterFrom]         = useState('')
  const [filterTo, setFilterTo]             = useState('')

  const allPaymentModes = [...BASE_PAYMENT_MODES, ...customPMs.map((m: any) => m.name)]

  function flash(msg: string) { setOk(msg); setTimeout(() => setOk(''), 3000) }
  function closeModal() { setModal(null); setError('') }

  // Load entries + custom fields when book changes
  async function loadBook(bookId: string) {
    setSelectedBook(bookId)
    setEntries([])
    const [entriesRes, fieldsRes] = await Promise.all([
      fetch(`/api/cashbook/${bookId}/entries`).then(r => r.json()),
      getCustomFields(bookId),
    ])
    setEntries(entriesRes.entries ?? [])
    setCustomFields(fieldsRes ?? [])
  }

  // Refresh parties on mount
  useEffect(() => {
    fetch(`/api/parties?siteId=${siteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d) && d.length > 0) setParties(d) }).catch(() => {})
  }, [siteId])

  // ── Book actions ─────────────────────────────────────────────
  async function handleCreateBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const r = await createCashbook(siteId, fd.get('name') as string, fd.get('description') as string)
    setLoading(false)
    if (r?.error) { setError(r.error); return }
    flash('Cashbook created!'); closeModal(); window.location.reload()
  }

  async function handleEditBook(e: React.FormEvent<HTMLFormElement>, book: any) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const r = await updateCashbook(book.id, fd.get('name') as string, fd.get('description') as string, siteId)
    setLoading(false)
    if (r?.error) { setError(r.error); return }
    flash('Cashbook updated!'); closeModal(); window.location.reload()
  }

  async function handleDeleteBook(id: string, name: string) {
    if (!confirm(`Delete cashbook "${name}" and ALL its entries? This cannot be undone.`)) return
    await deleteCashbook(id, siteId); flash('Cashbook deleted'); window.location.reload()
  }

  // ── Entry actions ────────────────────────────────────────────
  async function handleSaveEntry(data: any) {
    setLoading(true); setError('')
    data.cashbookId = selectedBook; data.siteId = siteId
    const r = await addCashbookEntry(data)
    setLoading(false)
    if (r?.error) { setError(r.error); return }
    flash('Entry added!'); closeModal()
    if (selectedBook) loadBook(selectedBook)
  }

  async function handleUpdateEntry(id: string, data: any) {
    setLoading(true); setError('')
    const r = await updateCashbookEntry(id, data, siteId)
    setLoading(false)
    if (r?.error) { setError(r.error); return }
    flash('Entry updated!'); closeModal()
    if (selectedBook) loadBook(selectedBook)
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return
    await deleteCashbookEntry(id, siteId)
    setEntries(prev => prev.filter(e => e.id !== id))
    flash('Entry deleted')
  }

  // ── Party actions ────────────────────────────────────────────
  async function handleUpdateParty(e: React.FormEvent<HTMLFormElement>, party: any) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const r = await updateParty(party.id, fd.get('name') as string, fd.get('type') as string, fd.get('phone') as string, siteId)
    setLoading(false)
    if (r?.error) { setError(r.error); return }
    setParties(prev => prev.map(p => p.id === party.id ? { ...p, name: fd.get('name'), type: fd.get('type'), phone: fd.get('phone') } : p))
    flash('Party updated!'); closeModal()
  }

  async function handleDeleteParty(id: string, name: string) {
    if (!confirm(`Remove party "${name}"?`)) return
    await deleteParty(id, siteId)
    setParties(prev => prev.filter(p => p.id !== id))
    flash('Party removed')
    if (modal?.type === 'parties') setModal({ type: 'parties' }) // keep modal open
  }

  // ── Custom Fields ────────────────────────────────────────────
  const [cfLabel, setCfLabel]     = useState('')
  const [cfType, setCfType]       = useState('TEXT')
  const [cfRequired, setCfRequired] = useState(false)
  const [cfOptions, setCfOptions] = useState<string[]>([])
  const [cfNewOpt, setCfNewOpt]   = useState('')

  async function handleSaveField(editField?: any) {
    setLoading(true); setError('')
    const r = editField
      ? await updateCustomField(editField.id, cfLabel, cfType, cfOptions, cfRequired, siteId)
      : await createCustomField(selectedBook!, cfLabel, cfType, cfOptions, cfRequired, siteId)
    setLoading(false)
    if (r?.error) { setError(r.error); return }
    flash(editField ? 'Field updated!' : 'Field added!')
    setCfLabel(''); setCfType('TEXT'); setCfRequired(false); setCfOptions([])
    if (selectedBook) { const fields = await getCustomFields(selectedBook); setCustomFields(fields) }
    closeModal()
  }

  async function handleDeleteField(id: string) {
    if (!confirm('Delete this custom field?')) return
    await deleteCustomField(id, siteId)
    setCustomFields(prev => prev.filter(f => f.id !== id))
    flash('Field deleted')
  }

  // ── Custom Payment Methods ────────────────────────────────────
  async function handleAddPaymentMethod(name: string) {
    const r = await createCustomPaymentMethod(siteId, name)
    if (r?.success) setCustomPMs(prev => [...prev, { id: r.id, name: r.name }])
    return
  }

  async function handleDeletePM(id: string, name: string) {
    if (!confirm(`Remove payment method "${name}"?`)) return
    await deleteCustomPaymentMethod(id, siteId)
    setCustomPMs(prev => prev.filter(m => m.id !== id))
    flash('Payment method removed')
  }

  // ── Access ────────────────────────────────────────────────────
  async function loadAccess() {
    if (!selectedBook) return
    const list = await getCashbookAccessList(selectedBook)
    setAccessList(list ?? [])
  }

  async function handleAddAccess(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const r = await createCashbookAccess(selectedBook!, fd.get('email') as string, fd.get('name') as string, fd.get('password') as string, siteId)
    setLoading(false)
    if (r?.error) { setError(r.error); return }
    flash('Access created!'); await loadAccess(); (e.target as HTMLFormElement).reset()
  }

  async function handleDeleteAccess(id: string, email: string) {
    if (!confirm(`Remove access for "${email}"?`)) return
    await deleteCashbookAccess(id, siteId)
    setAccessList(prev => prev.filter(a => a.id !== id))
    flash('Access removed')
  }

  // ── Filtered entries ──────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (filterSearch && !e.description?.toLowerCase().includes(filterSearch.toLowerCase()) && !e.partyName?.toLowerCase().includes(filterSearch.toLowerCase()) && !e.reference?.toLowerCase().includes(filterSearch.toLowerCase())) return false
      if (filterType && e.type !== filterType) return false
      if (filterParty && e.partyName !== filterParty) return false
      if (filterCategory && e.category !== filterCategory) return false
      if (filterMode && e.paymentMode !== filterMode) return false
      if (filterFrom && e.date < filterFrom) return false
      if (filterTo && e.date > filterTo) return false
      return true
    })
  }, [entries, filterSearch, filterType, filterParty, filterCategory, filterMode, filterFrom, filterTo])

  const income  = filteredEntries.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0)
  const expense = filteredEntries.filter(e => e.type !== 'INCOME').reduce((s, e) => s + e.amount, 0)
  const net     = income - expense
  const currentBook = books.find(b => b.id === selectedBook)

  const hasFilters = filterSearch || filterType || filterParty || filterCategory || filterMode || filterFrom || filterTo
  function clearFilters() { setFilterSearch(''); setFilterType(''); setFilterParty(''); setFilterCategory(''); setFilterMode(''); setFilterFrom(''); setFilterTo('') }

  // Unique filter values from entries
  const uniqueParties    = [...new Set(entries.map(e => e.partyName).filter(Boolean))]
  const uniqueCategories = [...new Set(entries.map(e => e.category).filter(Boolean))]
  const uniqueModes      = [...new Set(entries.map(e => e.paymentMode).filter(Boolean))]

  return (
    <div className="space-y-4">

      {/* Global feedback */}
      {ok && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">✓ {ok}</div>}

      {/* Top bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Book tabs */}
        <div className="flex gap-2 flex-wrap flex-1 min-w-0">
          {books.map(b => (
            <button key={b.id} type="button" onClick={() => loadBook(b.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${selectedBook === b.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-800 border-slate-300 hover:border-orange-400'}`}>
              📒 {b.name}
            </button>
          ))}
          <button type="button" onClick={() => setModal({ type: 'newBook' })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border-2 border-dashed border-slate-300 text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-colors">
            + New Cashbook
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {selectedBook && <>
            <button type="button" onClick={() => { setModal({ type: 'customFields' }) }} className="btn-secondary text-xs py-2 px-3">⚙ Fields</button>
            <button type="button" onClick={() => { setModal({ type: 'paymentMethods' }) }} className="btn-secondary text-xs py-2 px-3">💳 Modes</button>
            <button type="button" onClick={() => { setModal({ type: 'parties' }) }} className="btn-secondary text-xs py-2 px-3">👥 Parties ({parties.length})</button>
            <button type="button" onClick={() => { loadAccess(); setModal({ type: 'access' }) }} className="btn-secondary text-xs py-2 px-3">🔑 Access</button>
            {currentBook && <>
              <button type="button" onClick={() => setModal({ type: 'editBook', book: currentBook })} className="btn-secondary text-xs py-2 px-3">✏ Edit</button>
              <button type="button" onClick={() => handleDeleteBook(currentBook.id, currentBook.name)} className="text-xs py-2 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors">🗑</button>
            </>}
            <button type="button" onClick={() => setModal({ type: 'addEntry' })} className="btn text-sm">+ Add Entry</button>
          </>}
        </div>
      </div>

      {/* No books */}
      {books.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📒</p>
          <p className="text-slate-700 font-bold mb-1">No cashbooks yet</p>
          <p className="text-slate-500 text-sm mb-4">Create a cashbook to track income, expenses & LPOs</p>
          <button type="button" onClick={() => setModal({ type: 'newBook' })} className="btn">Create First Cashbook</button>
        </div>
      )}

      {selectedBook && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Income</p>
              <p className="text-emerald-700 font-bold text-base">{fmt(income)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Expenses + LPOs</p>
              <p className="text-red-700 font-bold text-base">{fmt(expense)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Balance</p>
              <p className={`font-bold text-base ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{net >= 0 ? '+' : ''}{fmt(net)}</p>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="card p-4 space-y-3">
            {/* Search bar */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input className="input pl-10" placeholder="Search description, party, reference..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
            </div>

            {/* Filters row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <select className="input text-xs py-2" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
                <option value="LPO">LPO</option>
              </select>
              <select className="input text-xs py-2" value={filterParty} onChange={e => setFilterParty(e.target.value)}>
                <option value="">All Parties</option>
                {uniqueParties.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="input text-xs py-2" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="">All Categories</option>
                {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="input text-xs py-2" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
                <option value="">All Modes</option>
                {uniqueModes.map(m => <option key={m} value={m}>{m?.replace('_', ' ')}</option>)}
              </select>
              <input type="date" className="input text-xs py-2" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} placeholder="From date" title="From date" />
              <input type="date" className="input text-xs py-2" value={filterTo} onChange={e => setFilterTo(e.target.value)} placeholder="To date" title="To date" />
            </div>

            {hasFilters && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">{filteredEntries.length} of {entries.length} entries</span>
                <button type="button" onClick={clearFilters} className="text-xs text-orange-600 hover:underline font-semibold">Clear filters</button>
              </div>
            )}
          </div>

          {/* Export buttons */}
          {filteredEntries.length > 0 && (
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => exportToCSV(filteredEntries, currentBook?.name ?? 'Cashbook')}
                className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Export CSV
              </button>
              <button type="button" onClick={() => exportToPDF(filteredEntries, currentBook?.name ?? 'Cashbook', { income, expense, net })}
                className="btn text-xs py-2 px-4 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                Export PDF
              </button>
            </div>
          )}

          {/* Entries list */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Transactions ({filteredEntries.length})</h3>
              <div className="flex gap-3 text-xs font-semibold">
                <span className="text-emerald-700">↑ {filteredEntries.filter(e => e.type === 'INCOME').length} in</span>
                <span className="text-red-700">↓ {filteredEntries.filter(e => e.type !== 'INCOME').length} out</span>
              </div>
            </div>
            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                {hasFilters ? 'No entries match your filters.' : 'No entries yet. Click "+ Add Entry" to start.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredEntries.map((e: any) => {
                  const isPdf = e.proofUrl?.includes('application/pdf')
                  return (
                    <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-sm ${e.type === 'INCOME' ? 'bg-emerald-100' : e.type === 'LPO' ? 'bg-blue-100' : 'bg-red-100'}`}>
                        {e.type === 'INCOME' ? '↑' : e.type === 'LPO' ? '📋' : '↓'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 text-sm font-bold truncate">{e.description}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 items-center">
                          {e.partyName && <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">{e.partyName}</span>}
                          <span className="text-slate-500 text-xs">{e.category}</span>
                          <span className="text-slate-300 text-xs">·</span>
                          <span className="text-slate-500 text-xs">{e.paymentMode?.replace('_', ' ')}</span>
                          <span className="text-slate-300 text-xs">·</span>
                          <span className="text-slate-500 text-xs">{e.date}</span>
                          {e.reference && <><span className="text-slate-300 text-xs">·</span><span className="text-slate-400 text-xs">{e.reference}</span></>}
                          {e.lpoNumber && <span className="text-blue-600 text-xs font-medium">{e.lpoNumber}</span>}
                          {e.lpoStatus && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700">{e.lpoStatus}</span>}
                        </div>
                        {e.proofUrl && (
                          <a href={e.proofUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-xs text-blue-700 hover:underline font-medium">
                            {isPdf ? '📄 View PDF' : <><img src={e.proofUrl} alt="" className="w-6 h-6 rounded object-cover border border-slate-200 inline mr-1" />View Image</>}
                          </a>
                        )}
                        {e.updatedAt && <p className="text-slate-400 text-xs mt-0.5">Edited {e.updatedAt.split('T')[0]}</p>}
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
                        <p className={`font-bold text-sm ${e.type === 'INCOME' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {e.type === 'INCOME' ? '+' : '-'}{fmt(e.amount)}
                        </p>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => setModal({ type: 'viewEntry', entry: e })}
                            className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors">View</button>
                          <button type="button" onClick={() => setModal({ type: 'editEntry', entry: e })}
                            className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors">Edit</button>
                          <button type="button" onClick={() => handleDeleteEntry(e.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors">Del</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* New Book */}
            {modal.type === 'newBook' && (
              <div className="p-6 space-y-4">
                <h3 className="font-bold text-slate-900 text-lg">Create New Cashbook</h3>
                {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                <form onSubmit={handleCreateBook} className="space-y-4">
                  <div><label className="label">Book Name *</label><input name="name" className="input" required placeholder="e.g. Main Account, Petty Cash" /></div>
                  <div><label className="label">Description</label><input name="description" className="input" placeholder="What is this book for?" /></div>
                  <div className="flex gap-3"><button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">{loading ? 'Creating...' : 'Create'}</button></div>
                </form>
              </div>
            )}

            {/* Edit Book */}
            {modal.type === 'editBook' && (
              <div className="p-6 space-y-4">
                <h3 className="font-bold text-slate-900 text-lg">Edit Cashbook</h3>
                {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                <form onSubmit={e => handleEditBook(e, modal.book)} className="space-y-4">
                  <div><label className="label">Book Name *</label><input name="name" className="input" required defaultValue={modal.book.name} /></div>
                  <div><label className="label">Description</label><input name="description" className="input" defaultValue={modal.book.description ?? ''} /></div>
                  <div className="flex gap-3"><button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">{loading ? 'Saving...' : 'Save'}</button></div>
                </form>
              </div>
            )}

            {/* Add Entry */}
            {modal.type === 'addEntry' && (
              <div className="p-6 space-y-4">
                <h3 className="font-bold text-slate-900 text-lg">Add Entry — {currentBook?.name}</h3>
                <EntryForm siteId={siteId} cashbookId={selectedBook!} customFields={customFields} allPaymentModes={allPaymentModes} parties={parties} onPartyAdded={p => setParties(prev => [...prev, p])} onSave={handleSaveEntry} onCancel={closeModal} loading={loading} error={error} />
              </div>
            )}

            {/* Edit Entry */}
            {modal.type === 'editEntry' && (
              <div className="p-6 space-y-4">
                <h3 className="font-bold text-slate-900 text-lg">Edit Entry</h3>
                <EntryForm siteId={siteId} cashbookId={selectedBook!} initialData={modal.entry} customFields={customFields} allPaymentModes={allPaymentModes} parties={parties} onPartyAdded={p => setParties(prev => [...prev, p])} onSave={data => handleUpdateEntry(modal.entry.id, data)} onCancel={closeModal} loading={loading} error={error} />
              </div>
            )}

            {/* View Entry */}
            {modal.type === 'viewEntry' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg">Entry Details</h3>
                  <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700 text-xl font-bold">✕</button>
                </div>
                {(() => {
                  const e = modal.entry
                  const rows = [
                    ['Type', e.type], ['Amount', fmt(e.amount)], ['Date', e.date],
                    ['Description', e.description], ['Party', e.partyName ?? '—'],
                    ['Category', e.category], ['Payment Mode', e.paymentMode?.replace('_', ' ')],
                    e.reference && ['Reference', e.reference],
                    e.lpoNumber && ['LPO Number', e.lpoNumber],
                    e.lpoStatus && ['LPO Status', e.lpoStatus],
                  ].filter(Boolean)
                  return (
                    <div className="space-y-2">
                      {rows.map(([k, v]: any) => (
                        <div key={k} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                          <span className="text-slate-500 text-sm">{k}</span>
                          <span className="text-slate-900 text-sm font-semibold">{v}</span>
                        </div>
                      ))}
                      {e.proofUrl && (
                        <div className="pt-2">
                          <a href={e.proofUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-blue-700 text-sm font-semibold hover:underline">
                            {e.proofUrl.includes('pdf') ? '📄' : <img src={e.proofUrl} alt="" className="w-8 h-8 rounded object-cover border" />}
                            View Proof / Attachment
                          </a>
                        </div>
                      )}
                    </div>
                  )
                })()}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setModal({ type: 'editEntry', entry: modal.entry })} className="btn flex-1 text-sm">Edit Entry</button>
                  <button type="button" onClick={() => { handleDeleteEntry(modal.entry.id); closeModal() }} className="btn-secondary flex-1 text-sm text-red-700 hover:bg-red-50">Delete</button>
                </div>
              </div>
            )}

            {/* Parties Manager */}
            {modal.type === 'parties' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg">Parties ({parties.length})</h3>
                  <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
                </div>
                {ok && <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">✓ {ok}</div>}
                {parties.length === 0 && <p className="text-slate-500 text-sm text-center py-4">No parties yet. Add them from the entry form.</p>}
                <div className="space-y-1.5">
                  {parties.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-slate-900 text-sm font-bold">{p.name}</span>
                        {p.type && <span className="ml-2 text-slate-500 text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5">{p.type}</span>}
                        {p.phone && <span className="ml-2 text-slate-400 text-xs">{p.phone}</span>}
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => setModal({ type: 'editParty', party: p })} className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold">Edit</button>
                        <button type="button" onClick={() => handleDeleteParty(p.id, p.name)} className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-semibold">Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Edit Party */}
            {modal.type === 'editParty' && (
              <div className="p-6 space-y-4">
                <h3 className="font-bold text-slate-900 text-lg">Edit Party</h3>
                {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                <form onSubmit={e => handleUpdateParty(e, modal.party)} className="space-y-4">
                  <div><label className="label">Name *</label><input name="name" className="input" required defaultValue={modal.party.name} /></div>
                  <div><label className="label">Type</label>
                    <select name="type" className="input" defaultValue={modal.party.type ?? ''}>
                      <option value="">None</option>
                      {PARTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Phone</label><input name="phone" className="input" defaultValue={modal.party.phone ?? ''} /></div>
                  <div className="flex gap-3"><button type="button" onClick={() => setModal({ type: 'parties' })} className="btn-secondary flex-1">Back</button><button type="submit" disabled={loading} className="btn flex-1">{loading ? 'Saving...' : 'Save'}</button></div>
                </form>
              </div>
            )}

            {/* Custom Fields */}
            {modal.type === 'customFields' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg">Custom Fields ({customFields.length})</h3>
                  <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
                </div>
                <p className="text-slate-500 text-xs">Add extra fields to the entry form for this cashbook.</p>
                {ok && <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">✓ {ok}</div>}
                {customFields.length === 0 && <p className="text-slate-400 text-sm text-center py-4">No custom fields yet.</p>}
                <div className="space-y-1.5">
                  {customFields.map(cf => {
                    const opts = cf.options ? JSON.parse(cf.options) : []
                    return (
                      <div key={cf.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <div>
                          <span className="text-slate-900 text-sm font-bold">{cf.label}</span>
                          <span className="ml-2 text-slate-500 text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5">{cf.fieldType}</span>
                          {cf.required && <span className="ml-1 text-red-600 text-xs">*required</span>}
                          {opts.length > 0 && <span className="ml-2 text-slate-400 text-xs">[{opts.slice(0, 3).join(', ')}{opts.length > 3 ? '...' : ''}]</span>}
                        </div>
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => { setCfLabel(cf.label); setCfType(cf.fieldType); setCfRequired(!!cf.required); setCfOptions(cf.options ? JSON.parse(cf.options) : []); setModal({ type: 'editField', field: cf }) }}
                            className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold">Edit</button>
                          <button type="button" onClick={() => handleDeleteField(cf.id)} className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-semibold">Del</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button type="button" onClick={() => { setCfLabel(''); setCfType('TEXT'); setCfRequired(false); setCfOptions([]); setModal({ type: 'addField' }) }} className="btn w-full text-sm">+ Add New Field</button>
              </div>
            )}

            {/* Add/Edit Custom Field */}
            {(modal.type === 'addField' || modal.type === 'editField') && (
              <div className="p-6 space-y-4">
                <h3 className="font-bold text-slate-900 text-lg">{modal.type === 'editField' ? 'Edit' : 'Add'} Custom Field</h3>
                {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                <div><label className="label">Field Label *</label><input className="input" required value={cfLabel} onChange={e => setCfLabel(e.target.value)} placeholder="e.g. Invoice Number, Site Name" /></div>
                <div><label className="label">Field Type</label>
                  <select className="input" value={cfType} onChange={e => setCfType(e.target.value)}>
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {cfType === 'DROPDOWN' && (
                  <div>
                    <label className="label">Dropdown Options</label>
                    <div className="space-y-1.5">
                      {cfOptions.map((opt, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input className="input flex-1 text-sm" value={opt} onChange={e => setCfOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))} />
                          <button type="button" onClick={() => setCfOptions(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 font-bold p-1">✕</button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input className="input flex-1 text-sm" placeholder="New option..." value={cfNewOpt} onChange={e => setCfNewOpt(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && cfNewOpt.trim()) { setCfOptions(prev => [...prev, cfNewOpt.trim()]); setCfNewOpt(''); e.preventDefault() } }} />
                        <button type="button" onClick={() => { if (cfNewOpt.trim()) { setCfOptions(prev => [...prev, cfNewOpt.trim()]); setCfNewOpt('') } }} className="btn text-sm px-4">Add</button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="cf-required" checked={cfRequired} onChange={e => setCfRequired(e.target.checked)} className="w-4 h-4 accent-orange-500" />
                  <label htmlFor="cf-required" className="text-slate-700 text-sm font-medium cursor-pointer">Required field</label>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setModal({ type: 'customFields' })} className="btn-secondary flex-1">Back</button>
                  <button type="button" onClick={() => handleSaveField(modal.type === 'editField' ? modal.field : undefined)} disabled={loading || !cfLabel.trim()} className="btn flex-1 disabled:opacity-60">{loading ? 'Saving...' : 'Save Field'}</button>
                </div>
              </div>
            )}

            {/* Payment Methods */}
            {modal.type === 'paymentMethods' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg">Payment Methods</h3>
                  <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
                </div>
                <p className="text-slate-500 text-xs">Built-in: {BASE_PAYMENT_MODES.join(', ')}</p>
                {ok && <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">✓ {ok}</div>}
                <div className="space-y-1.5">
                  {customPMs.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-900 text-sm font-semibold">{m.name}</span>
                      <button type="button" onClick={() => handleDeletePM(m.id, m.name)} className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-semibold">Remove</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <SearchableDropdown options={[]} value="" onChange={async (v) => { if (v) await handleAddPaymentMethod(v) }} placeholder="Type new method name..." allowCustom onAddNew={handleAddPaymentMethod} />
                </div>
              </div>
            )}

            {/* Book Access */}
            {modal.type === 'access' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg">Cashbook Access</h3>
                  <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
                </div>
                <p className="text-slate-500 text-xs">Give someone access to only this cashbook. They log in with the credentials below and see nothing else in the system.</p>
                {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                {ok && <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">✓ {ok}</div>}

                {accessList.length > 0 && (
                  <div className="space-y-1.5">
                    {accessList.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div>
                          <p className="text-slate-900 text-sm font-semibold">{a.name}</p>
                          <p className="text-slate-500 text-xs">{a.email}</p>
                        </div>
                        <button type="button" onClick={() => handleDeleteAccess(a.id, a.email)} className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-semibold">Revoke</button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddAccess} className="space-y-3 border-t border-slate-200 pt-4">
                  <p className="text-xs font-bold text-slate-700">Create New Access</p>
                  <div><label className="label">Full Name *</label><input name="name" className="input" required placeholder="e.g. Ravi Sharma" /></div>
                  <div><label className="label">Email *</label><input name="email" type="email" className="input" required placeholder="ravi@example.com" /></div>
                  <div><label className="label">Password *</label><input name="password" type="password" className="input" required minLength={6} placeholder="Min 6 characters" /></div>
                  <p className="text-xs text-slate-500">They will log in at your SiteSutra URL with this email and password, and will only see this cashbook.</p>
                  <button type="submit" disabled={loading} className="btn w-full disabled:opacity-60">{loading ? 'Creating...' : 'Create Access'}</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
