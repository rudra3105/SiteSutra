'use client'

import { useState, useRef, useEffect } from 'react'
import { createCashbook, addCashbookEntry, deleteCashbook, deleteCashbookEntry, createParty, deleteParty } from '@/actions/cashbook'

// ── Helpers ───────────────────────────────────────────────────

function inr(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n.toFixed(0)}`
}

const PAYMENT_MODES = ['CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'BANK_TRANSFER']
const CATEGORIES    = ['Client Payment', 'Materials', 'Labour', 'Equipment', 'Transport', 'Rent', 'Fuel', 'Miscellaneous']
const PARTY_TYPES   = ['Client', 'Supplier', 'Contractor', 'Labour Contractor', 'Transporter', 'Other']

const ENTRY_TYPES = [
  { value: 'INCOME',  label: 'Income',              icon: '↑', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-400' },
  { value: 'EXPENSE', label: 'Expense',              icon: '↓', color: 'text-red-700',     bg: 'bg-red-50 border-red-400'         },
  { value: 'LPO',     label: 'LPO / Purchase Order', icon: '📋', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-400'       },
]

// ── Party Selector — NO nested form, uses button onClick ──────

function PartySelector({
  parties, value, onChange, onPartyAdded, siteId,
}: {
  parties: any[]
  value: string
  onChange: (v: string) => void
  onPartyAdded: (party: any) => void
  siteId: string
}) {
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newType, setNewType]   = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [adding, setAdding]     = useState(false)
  const [addError, setAddError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowAdd(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = parties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  // ── Add party — uses onClick NOT form submit ──────────────
  async function doAddParty() {
    if (!newName.trim()) { setAddError('Party name is required'); return }
    setAdding(true); setAddError('')
    try {
      const result = await createParty(siteId, newName.trim(), newType || undefined, newPhone || undefined)
      if (!result)        { setAddError('No response from server — check your login'); setAdding(false); return }
      if (result.error)   { setAddError(result.error); setAdding(false); return }
      const party = { id: result.id, name: result.name ?? newName.trim(), type: newType, phone: newPhone }
      onPartyAdded(party)
      onChange(party.name)
      setNewName(''); setNewType(''); setNewPhone(''); setAddError('')
      setShowAdd(false); setOpen(false); setSearch('')
    } catch (err: any) {
      setAddError(err?.message ?? 'Something went wrong')
    }
    setAdding(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch('') }}
        className="input flex items-center justify-between gap-2 text-left w-full"
      >
        <span className={value ? 'text-slate-900 font-semibold' : 'text-slate-400'}>
          {value || 'Select or add party...'}
        </span>
        <svg className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 overflow-hidden">

          {/* Search box */}
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-slate-900 placeholder-slate-400"
              placeholder="Search party name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
            />
          </div>

          {/* Party list */}
          <div className="max-h-48 overflow-y-auto">
            {value && (
              <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-50 italic">
                — Clear selection
              </button>
            )}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs text-slate-500 text-center">
                {search ? `No party matching "${search}"` : 'No parties yet — add one below'}
              </p>
            )}
            {filtered.map(p => (
              <button key={p.id} type="button"
                onClick={() => { onChange(p.name); setOpen(false); setSearch('') }}
                className={`w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-orange-50 transition-colors ${value === p.name ? 'bg-orange-50' : ''}`}>
                <span className="text-slate-900 text-sm font-semibold">{p.name}</span>
                {p.type && <span className="text-slate-500 text-xs bg-slate-100 px-2 py-0.5 rounded-md">{p.type}</span>}
              </button>
            ))}
          </div>

          {/* Add party section — NO FORM TAG */}
          <div className="border-t border-slate-200">
            {!showAdd ? (
              <button type="button" onClick={() => setShowAdd(true)}
                className="w-full px-3 py-2.5 text-left text-sm font-semibold text-orange-600 hover:bg-orange-50 flex items-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add New Party
              </button>
            ) : (
              <div className="p-3 space-y-2 bg-orange-50">
                <p className="text-xs font-bold text-orange-800">Add New Party</p>
                {addError && <p className="text-red-600 text-xs font-medium bg-red-50 border border-red-200 rounded px-2 py-1">{addError}</p>}

                {/* Party name — plain input, no form */}
                <input
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-slate-900 placeholder-slate-400"
                  placeholder="Party name *"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    e.stopPropagation()
                    if (e.key === 'Enter') { e.preventDefault(); doAddParty() }
                  }}
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="text-sm px-2 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-slate-900"
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                  >
                    <option value="">Type (optional)</option>
                    {PARTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    className="text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-slate-900 placeholder-slate-400"
                    placeholder="Phone (optional)"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    onKeyDown={e => e.stopPropagation()}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowAdd(false); setNewName(''); setNewType(''); setNewPhone(''); setAddError('') }}
                    className="flex-1 text-xs py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={doAddParty}
                    disabled={adding || !newName.trim()}
                    className="flex-1 text-xs py-2 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {adding ? 'Saving...' : 'Save Party'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Proof Upload ──────────────────────────────────────────────

function ProofUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadError('')
    const fd = new FormData()
    fd.append('file', file)
    const res  = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (!res.ok || data.error) { setUploadError(data.error ?? 'Upload failed'); return }
    setFileName(file.name)
    onChange(data.url)
  }

  const isPdf = value?.includes('application/pdf')

  return (
    <div>
      <label className="label">
        Proof / Attachment
        <span className="ml-1 font-normal text-slate-500 normal-case">(image or PDF, max 5MB)</span>
      </label>
      {value ? (
        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center gap-3">
          {isPdf ? (
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          ) : (
            <img src={value} alt="Proof" className="w-12 h-12 object-cover rounded-lg border border-slate-200 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 text-xs font-semibold truncate">{fileName || 'Attached file'}</p>
            <p className="text-slate-500 text-xs">{isPdf ? 'PDF document' : 'Image'}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <a href={value} target="_blank" rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-semibold hover:bg-blue-100">
              View
            </a>
            <button type="button" onClick={() => { onChange(''); setFileName(''); if (inputRef.current) inputRef.current.value = '' }}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold hover:bg-red-100">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label className={`flex items-center justify-center gap-3 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${uploading ? 'border-orange-300 bg-orange-50' : 'border-slate-300 hover:border-orange-400 hover:bg-orange-50'}`}>
          <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} disabled={uploading} />
          {uploading ? (
            <>
              <svg className="w-5 h-5 text-orange-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-orange-700 text-sm font-medium">Uploading...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="text-center">
                <span className="text-slate-700 text-sm font-semibold">Click to upload</span>
                <p className="text-slate-500 text-xs">JPG, PNG, WEBP or PDF — max 5MB</p>
              </div>
            </>
          )}
        </label>
      )}
      {uploadError && <p className="text-red-600 text-xs mt-1">{uploadError}</p>}
    </div>
  )
}

// ── Main CashbookView ─────────────────────────────────────────

export function CashbookView({ siteId, initialBooks, initialParties }: {
  siteId: string
  initialBooks: any[]
  initialParties: any[]
}) {
  const [books]                         = useState(initialBooks)
  const [parties, setParties]           = useState(initialParties)
  const [selectedBook, setSelectedBook] = useState<string | null>(initialBooks[0]?.id ?? null)
  const [entries, setEntries]           = useState<any[]>([])
  const [showNewBook, setShowNewBook]   = useState(false)
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [entryType, setEntryType]       = useState('INCOME')
  const [bookName, setBookName]         = useState('')
  const [bookDesc, setBookDesc]         = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [ok, setOk]                     = useState('')
  const [partyName, setPartyName]       = useState('')
  const [proofUrl, setProofUrl]         = useState('')
  const [showParties, setShowParties]   = useState(false)
  const entryFormRef                    = useRef<HTMLFormElement>(null)

  function flash(msg: string) { setOk(msg); setTimeout(() => setOk(''), 3000) }

  // Refresh parties on mount
  useEffect(() => {
    fetch(`/api/parties?siteId=${siteId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setParties(data) })
      .catch(() => {})
  }, [siteId])

  async function loadEntries(bookId: string) {
    setSelectedBook(bookId)
    const res  = await fetch(`/api/cashbook/${bookId}/entries`)
    const data = await res.json()
    setEntries(data.entries ?? [])
  }

  async function handleCreateBook(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const result = await createCashbook(siteId, bookName, bookDesc)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    flash('Cashbook created!'); setShowNewBook(false); setBookName(''); setBookDesc('')
    window.location.reload()
  }

  async function handleAddEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const data: Record<string, unknown> = Object.fromEntries(fd)
    data.siteId     = siteId
    data.cashbookId = selectedBook
    data.type       = entryType
    data.partyName  = partyName  || null
    data.proofUrl   = proofUrl   || null
    const result = await addCashbookEntry(data)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    flash('Entry added!')
    setShowAddEntry(false); setPartyName(''); setProofUrl('')
    entryFormRef.current?.reset()
    if (selectedBook) loadEntries(selectedBook)
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return
    await deleteCashbookEntry(id, siteId)
    if (selectedBook) loadEntries(selectedBook)
    flash('Entry deleted')
  }

  async function handleDeleteBook(id: string, name: string) {
    if (!confirm(`Delete cashbook "${name}" and ALL its entries?`)) return
    await deleteCashbook(id, siteId)
    window.location.reload()
  }

  async function handleDeleteParty(id: string, name: string) {
    if (!confirm(`Remove party "${name}"?`)) return
    await deleteParty(id, siteId)
    setParties(prev => prev.filter(p => p.id !== id))
    flash('Party removed')
  }

  const currentBook = books.find(b => b.id === selectedBook)
  const income  = entries.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0)
  const expense = entries.filter(e => e.type !== 'INCOME').reduce((s, e) => s + e.amount, 0)
  const net     = income - expense

  return (
    <div className="space-y-5">
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold">{error}</div>}
      {ok    && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">✓ {ok}</div>}

      {/* Book selector bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap flex-1 min-w-0">
          {books.map(b => (
            <button key={b.id} type="button" onClick={() => loadEntries(b.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                selectedBook === b.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-800 border-slate-300 hover:border-orange-400'
              }`}>
              📒 {b.name}
            </button>
          ))}
          <button type="button" onClick={() => setShowNewBook(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border-2 border-dashed border-slate-300 text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-colors">
            + New Cashbook
          </button>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button type="button" onClick={() => setShowParties(p => !p)}
            className="btn-secondary text-sm flex items-center gap-1.5">
            👥 Parties ({parties.length})
          </button>
          {selectedBook && (
            <button type="button" onClick={() => { setShowAddEntry(true); setPartyName(''); setProofUrl('') }} className="btn text-sm">
              + Add Entry
            </button>
          )}
        </div>
      </div>

      {/* Parties panel */}
      {showParties && (
        <div className="card p-4 space-y-3 border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">All Parties ({parties.length})</h3>
            <button type="button" onClick={() => setShowParties(false)} className="text-slate-400 hover:text-slate-700 p-1">✕</button>
          </div>
          {parties.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-3">No parties yet. Add via the entry form.</p>
          ) : (
            <div className="space-y-1">
              {parties.map(p => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-slate-900 text-sm font-semibold">{p.name}</span>
                    {p.type  && <span className="ml-2 text-slate-500 text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5">{p.type}</span>}
                    {p.phone && <span className="ml-2 text-slate-400 text-xs">{p.phone}</span>}
                  </div>
                  <button type="button" onClick={() => handleDeleteParty(p.id, p.name)}
                    className="text-slate-400 hover:text-red-600 transition-colors text-xs px-2 py-1">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New cashbook form */}
      {showNewBook && (
        <div className="card p-5 border-2 border-orange-200">
          <h3 className="font-bold text-slate-900 mb-4">Create New Cashbook</h3>
          <form onSubmit={handleCreateBook} className="space-y-3">
            <div>
              <label className="label">Book Name *</label>
              <input className="input" required value={bookName} onChange={e => setBookName(e.target.value)}
                placeholder="e.g. Main Account, Petty Cash, Material Purchases" />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={bookDesc} onChange={e => setBookDesc(e.target.value)}
                placeholder="What is this cashbook for?" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowNewBook(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">{loading ? 'Creating...' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      {/* No books */}
      {books.length === 0 && !showNewBook && (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📒</p>
          <p className="text-slate-700 font-bold mb-1">No cashbooks yet</p>
          <p className="text-slate-500 text-sm mb-4">Create a cashbook to track income, expenses & LPOs</p>
          <button type="button" onClick={() => setShowNewBook(true)} className="btn">Create First Cashbook</button>
        </div>
      )}

      {/* Book content */}
      {selectedBook && (
        <div className="space-y-4">

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Income</p>
              <p className="text-emerald-700 font-bold text-xl">{inr(income)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Expenses + LPOs</p>
              <p className="text-red-700 font-bold text-xl">{inr(expense)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Balance</p>
              <p className={`font-bold text-xl ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{net >= 0 ? '+' : ''}{inr(net)}</p>
            </div>
          </div>

          {/* Add entry form — the ONLY form on the page */}
          {showAddEntry && (
            <div className="card p-5 border-2 border-orange-200 space-y-4">
              <h3 className="font-bold text-slate-900">Add Entry to "{currentBook?.name}"</h3>

              {/* Entry type buttons */}
              <div className="grid grid-cols-3 gap-2">
                {ENTRY_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setEntryType(t.value)}
                    className={`p-3 rounded-xl text-xs font-bold border-2 transition-all text-center ${
                      entryType === t.value ? `${t.bg} ${t.color} border-current` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                    }`}>
                    <span className="block text-base mb-0.5">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Party selector OUTSIDE the form — uses button not submit */}
              <div>
                <label className="label">Party Name</label>
                <PartySelector
                  parties={parties}
                  value={partyName}
                  onChange={setPartyName}
                  onPartyAdded={p => setParties(prev => [...prev, p])}
                  siteId={siteId}
                />
              </div>

              {/* The entry form — does NOT contain PartySelector */}
              <form ref={entryFormRef} onSubmit={handleAddEntry} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Amount (₹) *</label>
                    <input name="amount" type="number" className="input" required min="0.01" step="0.01" placeholder="50000" />
                  </div>
                  <div>
                    <label className="label">Date *</label>
                    <input name="date" type="date" className="input" required defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>

                <div>
                  <label className="label">Description *</label>
                  <input name="description" className="input" required placeholder="What is this entry for?" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Category *</label>
                    <input name="category" className="input" required list="cats" placeholder="Select or type..." />
                    <datalist id="cats">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  <div>
                    <label className="label">Payment Mode *</label>
                    <select name="paymentMode" className="input" required>
                      {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                </div>

                {entryType === 'LPO' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">LPO Number</label>
                      <input name="lpoNumber" className="input" placeholder="LPO-2024-001" />
                    </div>
                    <div>
                      <label className="label">LPO Status</label>
                      <select name="lpoStatus" className="input">
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="RECEIVED">Received</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">Reference / Invoice No</label>
                  <input name="reference" className="input" placeholder="INV-001 (optional)" />
                </div>

                {/* Proof upload */}
                <ProofUpload value={proofUrl} onChange={setProofUrl} />

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { setShowAddEntry(false); setProofUrl(''); setPartyName('') }}
                    className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">
                    {loading ? 'Saving...' : `Add ${ENTRY_TYPES.find(t => t.value === entryType)?.label}`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Entries list */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Transactions ({entries.length})</h3>
              <div className="flex gap-3 text-xs font-semibold">
                <span className="text-emerald-700">↑ {entries.filter(e => e.type === 'INCOME').length} in</span>
                <span className="text-red-700">↓ {entries.filter(e => e.type !== 'INCOME').length} out</span>
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No entries yet. Click "+ Add Entry" to start.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {entries.map((e: any) => {
                  const isPdf = e.proofUrl?.includes('application/pdf')
                  return (
                    <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-base ${
                        e.type === 'INCOME' ? 'bg-emerald-100' : e.type === 'LPO' ? 'bg-blue-100' : 'bg-red-100'
                      }`}>
                        {e.type === 'INCOME' ? '↑' : e.type === 'LPO' ? '📋' : '↓'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 text-sm font-bold truncate">{e.description}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 items-center">
                          {e.partyName && (
                            <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-1.5 py-0.5">
                              {e.partyName}
                            </span>
                          )}
                          <span className="text-slate-500 text-xs">{e.category}</span>
                          <span className="text-slate-300 text-xs">·</span>
                          <span className="text-slate-500 text-xs">{e.paymentMode?.replace('_', ' ')}</span>
                          <span className="text-slate-300 text-xs">·</span>
                          <span className="text-slate-500 text-xs">{e.date}</span>
                          {e.lpoNumber && <span className="text-blue-600 text-xs font-medium">{e.lpoNumber}</span>}
                          {e.lpoStatus && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700">{e.lpoStatus}</span>}
                          {e.reference && <span className="text-slate-400 text-xs">{e.reference}</span>}
                        </div>
                        {e.proofUrl && (
                          <a href={e.proofUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-blue-700 hover:underline font-semibold">
                            {isPdf ? '📄 View PDF' : (
                              <>
                                <img src={e.proofUrl} alt="proof" className="w-8 h-8 rounded object-cover border border-slate-200 inline" />
                                View Image
                              </>
                            )}
                          </a>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <p className={`font-bold text-sm ${e.type === 'INCOME' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {e.type === 'INCOME' ? '+' : '-'}{inr(e.amount)}
                        </p>
                        <button type="button" onClick={() => handleDeleteEntry(e.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors text-xs">✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
