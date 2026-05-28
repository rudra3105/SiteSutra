'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  createCashbook, updateCashbook, deleteCashbook,
  addCashbookEntry, updateCashbookEntry, deleteCashbookEntry,
  createParty, updateParty, deleteParty,
  getCustomFields, createCustomField, updateCustomField, deleteCustomField,
  getCustomPaymentMethods, createCustomPaymentMethod, deleteCustomPaymentMethod,
  getCashbookAccessList, createCashbookAccess, deleteCashbookAccess,
} from '@/actions/cashbook'

// ── Constants ─────────────────────────────────────────────────
const BASE_PAYMENT_MODES = ['Cash', 'Online', 'Cheque', 'Bank Transfer', 'UPI', 'NEFT', 'RTGS']
const BASE_CATEGORIES    = ['Sales', 'Purchase', 'Expense', 'Income', 'Labour', 'Materials', 'Transport', 'Rent', 'Fuel', 'Miscellaneous']
const PARTY_TYPES        = ['Client', 'Supplier', 'Contractor', 'Labour Contractor', 'Transporter', 'Other']
const FIELD_TYPES        = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN']
const ENTRY_TYPES        = [
  { value: 'IN',  label: 'Cash Out',     color: 'text-red-600',     bg: 'bg-red-50 border-red-400',     dot: 'bg-red-500'     },
  { value: 'OUT', label: 'Cash In', color: 'text-green-700',   bg: 'bg-green-50 border-green-400', dot: 'bg-green-500'   },
]
const PAGE_SIZE = 50

// ── Helpers ───────────────────────────────────────────────────
function fmtAmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function fmtDateTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    '\n' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
}

// ── Editable Dropdown (search + add new) ─────────────────────
function EditableDropdown({
  options, value, onChange, placeholder = 'Select...', onAddOption,
}: {
  options: string[]; value: string; onChange: (v: string) => void
  placeholder?: string; onAddOption?: (v: string) => Promise<void>
}) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
  const canAdd   = !!onAddOption && search.trim() && !options.some(o => o.toLowerCase() === search.trim().toLowerCase())

  async function handleAdd() {
    if (!onAddOption || !search.trim()) return
    setAdding(true)
    await onAddOption(search.trim())
    onChange(search.trim())
    setSearch(''); setOpen(false)
    setAdding(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-left text-sm flex items-center justify-between bg-white hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors min-h-[38px]">
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>{value || placeholder}</span>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-900 placeholder-slate-400"
              placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && canAdd) handleAdd() }} />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {value && (
              <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-50 italic">— Clear</button>
            )}
            {filtered.length === 0 && !canAdd && <p className="px-3 py-3 text-xs text-slate-400 text-center">No options found</p>}
            {filtered.map(o => (
              <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); setSearch('') }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${value === o ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-900'}`}>
                {o}
              </button>
            ))}
          </div>
          {onAddOption && (
            <div className="border-t border-slate-200">
              {canAdd ? (
                <button type="button" onClick={handleAdd} disabled={adding}
                  className="w-full px-3 py-2.5 text-left text-sm font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-2 transition-colors disabled:opacity-50">
                  {adding ? '...' : `+ Add "${search.trim()}"`}
                </button>
              ) : (
                <p className="px-3 py-2 text-xs text-slate-400 italic text-center">Type to add a new option</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Party Selector (same pattern, no nested form) ─────────────
function PartySelector({ parties, value, onChange, onPartyAdded, siteId, cashbookId }: {
  parties: any[]; value: string; onChange: (v: string) => void
  onPartyAdded: (p: any) => void; siteId: string; cashbookId?: string
}) {
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newType, setNewType]   = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [adding, setAdding]     = useState(false)
  const [err, setErr]           = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowAdd(false) } }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = parties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  async function doAdd() {
    if (!newName.trim()) { setErr('Name required'); return }
    setAdding(true); setErr('')
    try {
      const r = await createParty(siteId, newName.trim(), newType || undefined, newPhone || undefined, cashbookId)
      if (!r) { setErr('No response'); setAdding(false); return }
      if (r.error) { setErr(r.error); setAdding(false); return }
      const p = { id: r.id, name: r.name ?? newName.trim(), type: newType, phone: newPhone }
      onPartyAdded(p); onChange(p.name)
      setNewName(''); setNewType(''); setNewPhone(''); setShowAdd(false); setOpen(false); setSearch('')
    } catch (e: any) { setErr(e?.message ?? 'Error') }
    setAdding(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-left text-sm flex items-center justify-between bg-white hover:border-blue-400 focus:outline-none min-h-[38px]">
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>{value || 'Select party...'}</span>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-900 placeholder-slate-400"
              placeholder="Search party..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.stopPropagation()} />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {value && <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-50 italic">— Clear</button>}
            {filtered.length === 0 && !showAdd && <p className="px-3 py-3 text-xs text-slate-400 text-center">{search ? `No match for "${search}"` : 'No parties yet'}</p>}
            {filtered.map(p => (
              <button key={p.id} type="button" onClick={() => { onChange(p.name); setOpen(false); setSearch('') }}
                className={`w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-blue-50 transition-colors ${value === p.name ? 'bg-blue-50' : ''}`}>
                <span className="text-slate-900 text-sm font-semibold">{p.name}</span>
                {p.type && <span className="text-slate-400 text-xs bg-slate-100 px-2 py-0.5 rounded">{p.type}</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-200">
            {!showAdd ? (
              <button type="button" onClick={() => setShowAdd(true)}
                className="w-full px-3 py-2.5 text-left text-sm font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Add New Party
              </button>
            ) : (
              <div className="p-3 space-y-2 bg-blue-50">
                <p className="text-xs font-bold text-blue-800">Add New Party</p>
                {err && <p className="text-red-600 text-xs">{err}</p>}
                <input className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Party name *" value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); doAdd() } }} />
                <div className="grid grid-cols-2 gap-2">
                  <select className="text-sm px-2 py-2 rounded-lg border border-slate-300 bg-white text-slate-900" value={newType} onChange={e => setNewType(e.target.value)}>
                    <option value="">Type (optional)</option>
                    {PARTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                    placeholder="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} onKeyDown={e => e.stopPropagation()} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowAdd(false); setNewName(''); setErr('') }} className="flex-1 text-xs py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold">Cancel</button>
                  <button type="button" onClick={doAdd} disabled={adding || !newName.trim()} className="flex-1 text-xs py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50">
                    {adding ? 'Saving...' : 'Save'}
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
  const [err, setErr]             = useState('')
  const [fileName, setFileName]   = useState('')
  const ref = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setErr('')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (!res.ok || data.error) { setErr(data.error ?? 'Upload failed'); return }
    setFileName(file.name); onChange(data.url)
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
        Bill / Proof <span className="font-normal text-slate-400 normal-case">(image or PDF, max 5MB)</span>
      </label>
      {value ? (
        <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex items-center gap-3">
          {value.includes('pdf')
            ? <div className="w-9 h-9 bg-red-100 rounded flex items-center justify-center flex-shrink-0 text-red-600 text-xs font-bold">PDF</div>
            : <img src={value} alt="Proof" className="w-9 h-9 object-cover rounded border border-slate-200 flex-shrink-0" />
          }
          <div className="flex-1 min-w-0"><p className="text-slate-800 text-xs font-medium truncate">{fileName || 'Attached'}</p></div>
          <div className="flex gap-2 flex-shrink-0">
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold">View</a>
            <button type="button" onClick={() => { onChange(''); setFileName(''); if (ref.current) ref.current.value = '' }} className="text-xs px-2.5 py-1 rounded bg-red-50 border border-red-200 text-red-700 font-semibold">×</button>
          </div>
        </div>
      ) : (
        <label className={`flex items-center gap-3 border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${uploading ? 'border-blue-300 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'}`}>
          <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} disabled={uploading} />
          {uploading
            ? <span className="text-blue-600 text-sm font-medium">Uploading...</span>
            : <><svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg><span className="text-slate-600 text-sm">Click to attach bill/proof</span></>
          }
        </label>
      )}
      {err && <p className="text-red-600 text-xs mt-1">{err}</p>}
    </div>
  )
}

// ── Entry Drawer (Add/Edit) ───────────────────────────────────
function EntryDrawer({
  open, onClose, siteId, cashbookId, initialData, customFields, allPaymentModes, allCategories, parties, onPartyAdded, onSave, onAddPaymentMode, onAddCategory,
}: {
  open: boolean; onClose: () => void; siteId: string; cashbookId: string; initialData?: any
  customFields: any[]; allPaymentModes: string[]; allCategories: string[]; parties: any[]
  onPartyAdded: (p: any) => void; onSave: (data: any) => void; onAddPaymentMode: (v: string) => Promise<void>; onAddCategory: (v: string) => Promise<void>
}) {
  const [entryType, setEntryType]     = useState(initialData?.type ?? 'OUT')
  const [partyName, setPartyName]     = useState(initialData?.partyName ?? '')
  const [proofUrl, setProofUrl]       = useState(initialData?.proofUrl ?? '')
  const [category, setCategory]       = useState(initialData?.category ?? '')
  const [paymentMode, setPaymentMode] = useState(initialData?.paymentMode ?? 'Cash')
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    initialData?.customFieldValues
      ? (typeof initialData.customFieldValues === 'string' ? JSON.parse(initialData.customFieldValues) : initialData.customFieldValues)
      : {}
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (initialData) {
      setEntryType(initialData.type ?? 'OUT')
      setPartyName(initialData.partyName ?? '')
      setProofUrl(initialData.proofUrl ?? '')
      setCategory(initialData.category ?? '')
      setPaymentMode(initialData.paymentMode ?? 'Cash')
      setCustomValues(initialData.customFieldValues
        ? (typeof initialData.customFieldValues === 'string' ? JSON.parse(initialData.customFieldValues) : initialData.customFieldValues)
        : {})
    } else {
      setEntryType('OUT'); setPartyName(''); setProofUrl(''); setCategory(''); setPaymentMode('Cash'); setCustomValues({})
    }
    setError('')
  }, [initialData, open])

  if (!open) return null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data: any = Object.fromEntries(fd)
    data.type = entryType
    data.partyName  = partyName  || null
    data.proofUrl   = proofUrl   || null
    data.category   = category   || null
    data.paymentMode = paymentMode || null
    // Store custom field values as JSON
    if (Object.keys(customValues).length > 0) {
      data.customFieldValues = customValues
    }
    setLoading(true); setError('')
    Promise.resolve(onSave(data)).finally(() => setLoading(false))
  }

  const typeInfo = ENTRY_TYPES.find(t => t.value === entryType)!

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* Drawer */}
      <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-900 text-base">{initialData ? 'Edit Entry' : 'Add Entry'}</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 p-5 space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}

          {/* Cash Out / Cash In */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Transaction Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {ENTRY_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setEntryType(t.value)}
                  className={`py-3 rounded-xl text-sm font-bold border-2 transition-all text-center ${entryType === t.value ? `${t.bg} ${t.color} border-current` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                  <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${t.dot}`} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Amount (₹) *</label>
            <input name="amount" type="number" required min="0.01" step="0.01"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00" defaultValue={initialData?.amount ?? ''} />
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Date *</label>
            <input name="date" type="datetime-local" required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              defaultValue={initialData?.date ? initialData.date.slice(0, 16) : new Date().toISOString().slice(0, 16)} />
          </div>

          {/* Party */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Party Name</label>
            <PartySelector parties={parties} value={partyName} onChange={setPartyName} onPartyAdded={onPartyAdded} siteId={siteId} cashbookId={cashbookId} />
          </div>

          {/* Details / Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Details</label>
            <input name="description" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="What is this transaction for?" defaultValue={initialData?.description ?? ''} />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Category</label>
            <EditableDropdown options={allCategories} value={category} onChange={setCategory} placeholder="Select or add category..." onAddOption={onAddCategory} />
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Mode</label>
            <EditableDropdown options={allPaymentModes} value={paymentMode} onChange={setPaymentMode} placeholder="Select payment mode..." onAddOption={onAddPaymentMode} />
          </div>

          {/* Reference */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Reference / Invoice No</label>
            <input name="reference" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="INV-001 (optional)" defaultValue={initialData?.reference ?? ''} />
          </div>

          {/* Bill/Proof */}
          <ProofUpload value={proofUrl} onChange={setProofUrl} />

          {/* Custom Fields — rendered and saved properly */}
          {customFields.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Additional Fields</p>
              {customFields.map(cf => {
                const opts = cf.options ? JSON.parse(cf.options) : []
                return (
                  <div key={cf.id}>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      {cf.label}{cf.required ? ' *' : ''}
                    </label>
                    {cf.fieldType === 'DROPDOWN' ? (
                      <EditableDropdown options={opts} value={customValues[cf.id] ?? ''} onChange={v => setCustomValues(prev => ({ ...prev, [cf.id]: v }))} placeholder={`Select ${cf.label}...`} />
                    ) : cf.fieldType === 'DATE' ? (
                      <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" value={customValues[cf.id] ?? ''} onChange={e => setCustomValues(prev => ({ ...prev, [cf.id]: e.target.value }))} required={cf.required} />
                    ) : cf.fieldType === 'NUMBER' ? (
                      <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" value={customValues[cf.id] ?? ''} onChange={e => setCustomValues(prev => ({ ...prev, [cf.id]: e.target.value }))} placeholder={`Enter ${cf.label}`} required={cf.required} />
                    ) : (
                      <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" value={customValues[cf.id] ?? ''} onChange={e => setCustomValues(prev => ({ ...prev, [cf.id]: e.target.value }))} placeholder={`Enter ${cf.label}`} required={cf.required} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex gap-3 pt-4 pb-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading}
              className={`flex-1 py-3 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-60 ${entryType === 'OUT' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {loading ? 'Saving...' : initialData ? 'Update' : entryType === 'OUT' ? '+ Cash In' : '+ Cash Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Export helpers ────────────────────────────────────────────
function exportToCSV(entries: any[], bookName: string, crossBook = false) {
  const headers = crossBook
    ? ['Book', 'Date & Time', 'Type', 'Details', 'Party', 'Category', 'Mode', 'Bill', 'Amount (₹)']
    : ['Date & Time', 'Type', 'Details', 'Party', 'Category', 'Mode', 'Bill', 'Amount (₹)', 'Balance (₹)']
  let balance = 0
  const rows = [...entries].reverse().map(e => {
    const amt = e.type === 'OUT' ? e.amount : -e.amount
    balance += amt
    const typeLabel = e.type === 'OUT' ? 'Cash In' : 'Cash Out'
    if (crossBook) {
      return [e.bookName ?? '', e.date, typeLabel, e.description ?? '', e.partyName ?? '', e.category ?? '', e.paymentMode ?? '', e.proofUrl ? 'Yes' : '', e.amount.toFixed(2)]
    }
    return [e.date, typeLabel, e.description ?? '', e.partyName ?? '', e.category ?? '', e.paymentMode ?? '', e.proofUrl ? 'Yes' : '', e.amount.toFixed(2), balance.toFixed(2)]
  })
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a'); a.href = url; a.download = `${bookName}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

function exportToPDF(entries: any[], bookName: string, summary: any, crossBook = false) {
  let balance = 0
  const tableRows = [...entries].reverse().map(e => {
    const amt = e.type === 'OUT' ? e.amount : -e.amount; balance += amt
    const isOut = e.type === 'OUT'
    const bookCol = crossBook ? `<td style="font-size:10px;color:#64748b;white-space:nowrap">${e.bookName ?? ''}</td>` : ''
    const balCol  = crossBook ? '' : `<td style="text-align:right;font-weight:600;color:${balance >= 0 ? '#16a34a' : '#dc2626'}">${fmtAmt(balance)}</td>`
    return `<tr>
      ${bookCol}
      <td style="white-space:pre-line">${e.date ? new Date(e.date).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) + '\n' + new Date(e.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}).toUpperCase() : ''}</td>
      <td><strong>${e.description ?? ''}</strong>${e.partyName ? `<br><span style="color:#64748b;font-size:10px">${e.partyName}</span>` : ''}</td>
      <td>${e.category ?? ''}</td>
      <td>${e.paymentMode ?? ''}</td>
      <td style="text-align:center">${e.proofUrl ? '✓' : ''}</td>
      <td style="text-align:right;color:${isOut ? '#16a34a' : '#dc2626'};font-weight:700">${isOut ? '' : '-'}${fmtAmt(e.amount)}</td>
      ${balCol}
    </tr>`
  }).join('')

  const bookTh  = crossBook ? '<th>Book</th>' : ''
  const balTh   = crossBook ? '' : '<th style="text-align:right">Balance (₹)</th>'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${bookName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#0f172a;padding:20px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0}
  .title{font-size:18px;font-weight:700;color:#0f172a}
  .subtitle{font-size:11px;color:#64748b;margin-top:2px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
  .card{padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc}
  .card-label{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700;margin-bottom:3px}
  .card-value{font-size:16px;font-weight:700}
  .green{color:#16a34a}.red{color:#dc2626}
  table{width:100%;border-collapse:collapse;font-size:10px}
  thead tr{background:#1e293b;color:white}
  th{padding:7px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
  td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  .footer{margin-top:20px;font-size:9px;color:#94a3b8;text-align:center;padding-top:8px;border-top:1px solid #e2e8f0}
  @media print{body{padding:0}@page{margin:12mm;size:A4}}
</style></head><body>
<div class="header">
  <div><div class="title">${bookName}</div><div class="subtitle">Cashbook Report · Generated ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div></div>
  <div style="font-size:11px;color:#64748b;text-align:right">${entries.length} transactions</div>
</div>
<div class="summary">
  <div class="card"><div class="card-label">Cash In</div><div class="card-value green">₹${fmtAmt(summary.income)}</div></div>
  <div class="card"><div class="card-label">Cash Out</div><div class="card-value red">₹${fmtAmt(summary.expense)}</div></div>
  <div class="card"><div class="card-label">Net Balance</div><div class="card-value ${summary.net >= 0 ? 'green' : 'red'}">₹${fmtAmt(Math.abs(summary.net))}</div></div>
</div>
<table>
  <thead><tr>${bookTh}<th>Date & Time</th><th>Details</th><th>Category</th><th>Mode</th><th>Bill</th><th style="text-align:right">Amount (₹)</th>${balTh}</tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="footer">SiteSutra · Developed by Webrise Global (webriseglobal.com)</div>
</body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (win) { setTimeout(() => win.print(), 800) }
  setTimeout(() => URL.revokeObjectURL(url), 15000)
}

// ── Main CashbookView ─────────────────────────────────────────
export function CashbookView({ siteId, initialBooks, initialParties, initialCustomPaymentMethods }: {
  siteId: string; initialBooks: any[]; initialParties: any[]; initialCustomPaymentMethods: any[]
}) {
  const [books, setBooks]                 = useState(initialBooks)
  const [parties, setParties]             = useState(initialParties)
  const [customPMs, setCustomPMs]         = useState(initialCustomPaymentMethods.map((m: any) => m.name))
  const [customCats, setCustomCats]       = useState<string[]>([])
  const [selectedBook, setSelectedBook]   = useState<string | null>(initialBooks[0]?.id ?? null)
  const [entries, setEntries]             = useState<any[]>([])
  const [customFields, setCustomFields]   = useState<any[]>([])
  const [accessList, setAccessList]       = useState<any[]>([])
  const [page, setPage]                   = useState(1)
  const [selected, setSelected]           = useState<Set<string>>(new Set())
  const [loading, setLoading]             = useState(false)
  const [ok, setOk]                       = useState('')

  // Modals/drawers
  const [drawer, setDrawer]     = useState<{ open: boolean; entry?: any }>({ open: false })
  const [modal, setModal]       = useState<string | null>(null) // 'newBook'|'editBook'|'settings'|'access'|'view'
  const [viewEntry, setViewEntry] = useState<any>(null)
  const [editingBook, setEditingBook] = useState<any>(null)
  const [error, setError]       = useState('')
  // Cross-book report state
  const [crossModal, setCrossModal]   = useState(false)
  const [crossCategory, setCrossCategory] = useState('')
  const [crossDateFrom, setCrossDateFrom] = useState('')
  const [crossDateTo, setCrossDateTo]     = useState('')
  const [crossType, setCrossType]         = useState('')
  const [crossParty, setCrossParty]       = useState('')
  const [crossLoading, setCrossLoading]   = useState(false)

  // Custom field config state
  const [cfLabel, setCfLabel]   = useState('')
  const [cfType, setCfType]     = useState('TEXT')
  const [cfRequired, setCfRequired] = useState(false)
  const [cfOptions, setCfOptions] = useState<string[]>([])
  const [cfOptInput, setCfOptInput] = useState('')
  const [editingField, setEditingField] = useState<any>(null)

  // Filters
  const [filterSearch, setFilterSearch]     = useState('')
  const [filterType, setFilterType]         = useState('')
  const [filterParty, setFilterParty]       = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMode, setFilterMode]         = useState('')
  const [filterFrom, setFilterFrom]         = useState('')
  const [filterTo, setFilterTo]             = useState('')

  const allPaymentModes = [...BASE_PAYMENT_MODES, ...customPMs]
  const allCategories   = [...BASE_CATEGORIES, ...customCats]

  function flash(msg: string) { setOk(msg); setTimeout(() => setOk(''), 3000) }

  async function loadBook(bookId: string) {
    setSelectedBook(bookId); setEntries([]); setPage(1); setSelected(new Set())
    const [entriesRes, fields, bookParties] = await Promise.all([
      fetch(`/api/cashbook/${bookId}/entries`).then(r => r.json()),
      getCustomFields(bookId),
      fetch(`/api/parties?siteId=${siteId}&cashbookId=${bookId}`).then(r => r.json()),
    ])
    setEntries(entriesRes.entries ?? [])
    setCustomFields(fields ?? [])
    setParties(Array.isArray(bookParties) ? bookParties : [])
  }

  useEffect(() => {
    if (selectedBook) {
      fetch(`/api/parties?siteId=${siteId}&cashbookId=${selectedBook}`).then(r => r.json())
        .then(d => { if (Array.isArray(d)) setParties(d) }).catch(() => {})
    }
  }, [siteId])

  // ── Book CRUD ────────────────────────────────────────────────
  async function handleBookForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const name = fd.get('name') as string
    const desc = fd.get('description') as string
    const r = editingBook
      ? await updateCashbook(editingBook.id, name, desc, siteId)
      : await createCashbook(siteId, name, desc)
    setLoading(false)
    if (r?.error) { setError(r.error); return }
    flash(editingBook ? 'Book updated!' : 'Book created!'); setModal(null); window.location.reload()
  }

  async function handleDeleteBook() {
    if (!selectedBook || !confirm(`Delete "${editingBook?.name}" and ALL entries?`)) return
    await deleteCashbook(selectedBook, siteId); flash('Deleted'); window.location.reload()
  }

  // ── Entry CRUD ───────────────────────────────────────────────
  async function handleSaveEntry(data: any) {
    data.cashbookId = selectedBook; data.siteId = siteId
    const r = drawer.entry
      ? await updateCashbookEntry(drawer.entry.id, data, siteId)
      : await addCashbookEntry(data)
    if (r?.error) { setError(r.error); return }
    flash(drawer.entry ? 'Updated!' : 'Entry added!'); setDrawer({ open: false })
    if (selectedBook) loadBook(selectedBook)
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return
    await deleteCashbookEntry(id, siteId)
    setEntries(prev => prev.filter(e => e.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    flash('Deleted')
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selected.size} entries?`)) return
    for (const id of selected) await deleteCashbookEntry(id, siteId)
    setEntries(prev => prev.filter(e => !selected.has(e.id)))
    setSelected(new Set()); flash(`${selected.size} entries deleted`)
  }

  // ── Custom fields ─────────────────────────────────────────────
  async function saveCustomField() {
    if (!cfLabel.trim()) return
    setLoading(true)
    const r = editingField
      ? await updateCustomField(editingField.id, cfLabel, cfType, cfOptions, cfRequired, siteId)
      : await createCustomField(selectedBook!, cfLabel, cfType, cfOptions, cfRequired, siteId)
    setLoading(false)
    if (r?.error) { setError(r.error); return }
    flash('Saved!'); setCfLabel(''); setCfType('TEXT'); setCfRequired(false); setCfOptions([]); setEditingField(null)
    if (selectedBook) { const f = await getCustomFields(selectedBook); setCustomFields(f) }
  }

  async function deleteCustomFieldItem(id: string) {
    if (!confirm('Delete this field?')) return
    await deleteCustomField(id, siteId)
    setCustomFields(prev => prev.filter(f => f.id !== id))
    flash('Field deleted')
  }

  // ── Payment mode + category add ───────────────────────────────
  async function handleAddPaymentMode(name: string) {
    const r = await createCustomPaymentMethod(siteId, name)
    if (r?.success) setCustomPMs(prev => [...prev, name])
  }
  async function handleAddCategory(name: string) {
    setCustomCats(prev => [...prev, name])
    // Categories are saved per-entry, no separate table needed
  }

  // ── Access ────────────────────────────────────────────────────
  async function loadAccess() { if (selectedBook) { const l = await getCashbookAccessList(selectedBook); setAccessList(l ?? []) } }
  async function handleAddAccess(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const r = await createCashbookAccess(selectedBook!, fd.get('email') as string, fd.get('name') as string, fd.get('password') as string, siteId)
    setLoading(false)
    if (r?.error) { setError(r.error); return }
    flash('Access created!'); await loadAccess(); (e.target as HTMLFormElement).reset()
  }

  // ── Filtered + paginated ──────────────────────────────────────
  const filtered = useMemo(() => entries.filter(e => {
    if (filterSearch && !e.description?.toLowerCase().includes(filterSearch.toLowerCase()) && !e.partyName?.toLowerCase().includes(filterSearch.toLowerCase()) && !e.reference?.toLowerCase().includes(filterSearch.toLowerCase())) return false
    if (filterType && e.type !== filterType) return false
    if (filterParty && e.partyName !== filterParty) return false
    if (filterCategory && e.category !== filterCategory) return false
    if (filterMode && e.paymentMode !== filterMode) return false
    if (filterFrom && e.date < filterFrom) return false
    if (filterTo && e.date > filterTo) return false
    return true
  }), [entries, filterSearch, filterType, filterParty, filterCategory, filterMode, filterFrom, filterTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasFilters = filterSearch || filterType || filterParty || filterCategory || filterMode || filterFrom || filterTo

  // Running balance (computed from ALL entries, not just page)
  const balanceMap = useMemo(() => {
    const map: Record<string, number> = {}
    let bal = 0
    ;[...filtered].reverse().forEach(e => {
      bal += e.type === 'OUT' ? e.amount : -e.amount
      map[e.id] = bal
    })
    return map
  }, [filtered])

  const income  = filtered.filter(e => e.type === 'OUT').reduce((s, e) => s + e.amount, 0)
  const expense = filtered.filter(e => e.type !== 'OUT').reduce((s, e) => s + e.amount, 0)
  const net     = income - expense
  const currentBook = books.find(b => b.id === selectedBook)

  const uniqueParties    = [...new Set(entries.map(e => e.partyName).filter(Boolean))]
  const uniqueCategories = [...new Set(entries.map(e => e.category).filter(Boolean))]
  const uniqueModes      = [...new Set(entries.map(e => e.paymentMode).filter(Boolean))]

  // Cross-book export handlers
  async function handleCrossExport(format: 'csv' | 'pdf') {
    setCrossLoading(true)
    const params = new URLSearchParams({ siteId })
    if (crossCategory) params.set('category', crossCategory)
    if (crossDateFrom) params.set('dateFrom', crossDateFrom)
    if (crossDateTo)   params.set('dateTo', crossDateTo)
    if (crossType)     params.set('type', crossType)
    const res  = await fetch(`/api/cashbook/export?${params}`)
    const data = await res.json()
    let allEntries = data.entries ?? []
    // Apply party filter client-side (cross-book, party names may differ)
    if (crossParty) allEntries = allEntries.filter((e: any) => e.partyName === crossParty)
    const income  = allEntries.filter((e: any) => e.type === 'OUT').reduce((s: number, e: any) => s + e.amount, 0)
    const expense = allEntries.filter((e: any) => e.type !== 'OUT').reduce((s: number, e: any) => s + e.amount, 0)
    const label = [
      crossCategory ? `Category: ${crossCategory}` : '',
      crossParty    ? `Party: ${crossParty}`        : '',
      crossType     ? (crossType === 'OUT' ? 'Cash In' : 'Cash Out') : '',
      crossDateFrom && crossDateTo ? `${crossDateFrom} to ${crossDateTo}` : crossDateFrom ? `From ${crossDateFrom}` : crossDateTo ? `To ${crossDateTo}` : '',
    ].filter(Boolean).join(' · ')
    const title = `All Books — ${label || 'Complete Report'}`
    if (format === 'csv') exportToCSV(allEntries, title, true)
    else exportToPDF(allEntries, title, { income, expense, net: income - expense }, true)
    setCrossLoading(false)
    setCrossModal(false)
  }

  // Unique categories across all entries for cross-book filter
  const allUniqueCategories = [...new Set(entries.map((e:any) => e.category).filter(Boolean))]

  return (
    <div className="flex flex-col h-full bg-white">
      {ok && <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-sm font-semibold text-center">✓ {ok}</div>}

      {/* ── Book Tabs ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white overflow-x-auto flex-shrink-0">
        <div className="flex gap-1 flex-1 min-w-0">
          {books.map(b => (
            <button key={b.id} type="button" onClick={() => loadBook(b.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${selectedBook === b.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              📒 {b.name}
            </button>
          ))}
          <button type="button" onClick={() => { setEditingBook(null); setError(''); setModal('book') }}
            className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-semibold border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 whitespace-nowrap">
            + New
          </button>
        </div>

        {selectedBook && (
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={() => { setEditingBook(currentBook); setError(''); setModal('book') }}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors" title="Edit book">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button type="button" onClick={() => setModal('settings')} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors" title="Settings">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button type="button" onClick={() => { loadAccess(); setModal('access') }} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors" title="Access">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* No books */}
      {books.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
          <div className="text-5xl mb-4">📒</div>
          <p className="text-slate-700 font-bold text-lg mb-2">No cashbooks yet</p>
          <p className="text-slate-500 text-sm mb-6">Create your first cashbook to track transactions</p>
          <button type="button" onClick={() => { setEditingBook(null); setModal('book') }} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">Create Cashbook</button>
        </div>
      )}

      {selectedBook && (
        <>
          {/* ── Summary bar ── */}
          <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex-shrink-0 text-sm">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-slate-600">Cash In:</span><span className="font-bold text-green-700">₹{fmtAmt(income)}</span></div>
            <div className="text-slate-300">|</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-slate-600">Cash Out:</span><span className="font-bold text-red-600">₹{fmtAmt(expense)}</span></div>
            <div className="text-slate-300">|</div>
            <div className="flex items-center gap-1.5"><span className="text-slate-600">Balance:</span><span className={`font-bold ${net >= 0 ? 'text-green-700' : 'text-red-600'}`}>₹{fmtAmt(Math.abs(net))}</span></div>
            <div className="ml-auto flex gap-2">
              {hasFilters && (
                <span className="text-xs text-slate-500 italic mr-1">Exporting filtered view</span>
              )}
              <button type="button" onClick={() => exportToCSV(filtered, currentBook?.name ?? 'Cashbook')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-green-700 hover:border-green-300 text-xs font-semibold transition-colors" title={hasFilters ? 'Export filtered entries to CSV' : 'Export all entries to CSV'}>
                ↓ CSV
              </button>
              <button type="button" onClick={() => exportToPDF(filtered, currentBook?.name ?? 'Cashbook', { income, expense, net })}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-300 text-xs font-semibold transition-colors" title={hasFilters ? 'Export filtered entries to PDF' : 'Export all entries to PDF'}>
                ↓ PDF
              </button>
              <button type="button" onClick={() => { setCrossModal(true); setCrossCategory(''); setCrossDateFrom(''); setCrossDateTo(''); setCrossType('') }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 text-xs font-semibold transition-colors">
                📊 All Books Report
              </button>
            </div>
          </div>

          {/* ── Filters + Search ── */}
          <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  placeholder="Search transactions..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
              </div>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                <option value="OUT">Cash In</option>
                <option value="IN">Cash Out</option>
              </select>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" value={filterParty} onChange={e => setFilterParty(e.target.value)}>
                <option value="">All Parties</option>
                {uniqueParties.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
                <option value="">All Modes</option>
                {uniqueModes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From" />
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="To" />
              {hasFilters && <button type="button" onClick={() => { setFilterSearch(''); setFilterType(''); setFilterParty(''); setFilterCategory(''); setFilterMode(''); setFilterFrom(''); setFilterTo('') }} className="text-xs text-blue-600 hover:underline font-semibold whitespace-nowrap">Clear</button>}
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="text-sm text-slate-500 font-medium">
              Showing {filtered.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0} - {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} entries
              {selected.size > 0 && <span className="ml-3 text-blue-600 font-semibold">{selected.size} selected</span>}
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <button type="button" onClick={deleteSelected} className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100">Delete ({selected.size})</button>
              )}
              <button type="button" onClick={() => setDrawer({ open: true, entry: undefined })}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Add Entry
              </button>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" className="accent-blue-600"
                      checked={paginated.length > 0 && paginated.every(e => selected.has(e.id))}
                      onChange={ev => {
                        if (ev.target.checked) setSelected(prev => new Set([...prev, ...paginated.map(e => e.id)]))
                        else setSelected(prev => { const n = new Set(prev); paginated.forEach(e => n.delete(e.id)); return n })
                      }} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
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
                  <tr><td colSpan={9} className="px-4 py-16 text-center text-slate-400 text-sm">{hasFilters ? 'No entries match your filters.' : 'No entries yet. Click "Add Entry" to get started.'}</td></tr>
                ) : paginated.map((e: any) => {
                  const isReceived = e.type === 'OUT'
                  const bal = balanceMap[e.id] ?? 0
                  const isPdf = e.proofUrl?.includes('pdf')
                  return (
                    <tr key={e.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selected.has(e.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-3">
                        <input type="checkbox" className="accent-blue-600" checked={selected.has(e.id)}
                          onChange={ev => setSelected(prev => { const n = new Set(prev); ev.target.checked ? n.add(e.id) : n.delete(e.id); return n })} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{fmtDateTime(e.date)}</div>
                      </td>
                      <td className="px-3 py-3 max-w-[200px]">
                        <div className="text-slate-900 font-semibold text-sm truncate">{e.description || '—'}</div>
                        {e.partyName && <div className="text-slate-500 text-xs mt-0.5">by {e.partyName}</div>}
                        {e.reference && <div className="text-slate-400 text-xs">{e.reference}</div>}
                      </td>
                      <td className="px-3 py-3">
                        {e.category ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">{e.category}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-sm">{e.paymentMode || '—'}</td>
                      <td className="px-3 py-3 text-center">
                        {e.proofUrl ? (
                          <a href={e.proofUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors" title="View proof">
                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          </a>
                        ) : <span className="text-slate-200">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`font-bold text-sm ${isReceived ? 'text-green-700' : 'text-red-600'}`}>
                          {isReceived ? '' : '-'}₹{fmtAmt(e.amount)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`font-semibold text-sm ${bal >= 0 ? 'text-green-700' : 'text-red-600'}`}>₹{fmtAmt(bal)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button type="button" onClick={() => { setViewEntry(e); setModal('view') }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="View">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button type="button" onClick={() => setDrawer({ open: true, entry: e })}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button type="button" onClick={() => handleDeleteEntry(e.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-slate-200 bg-white flex-shrink-0">
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">← Prev</button>
              <span className="text-sm text-slate-600 font-medium">Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}

      {/* ── Cross-Book Report Modal ── */}
      {crossModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">📊 All Books Report</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Export entries from all cashbooks with filters</p>
                </div>
                <button type="button" onClick={() => setCrossModal(false)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
              </div>

              <div className="space-y-3">
                {/* Category filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Category <span className="text-slate-400 font-normal normal-case">(filter by one category across all books)</span>
                  </label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={crossCategory} onChange={e => setCrossCategory(e.target.value)}>
                    <option value="">All Categories</option>
                    {[...new Set(entries.map((e: any) => e.category).filter(Boolean))].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Type filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Transaction Type</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={crossType} onChange={e => setCrossType(e.target.value)}>
                    <option value="">All Types</option>
                    <option value="OUT">Cash In (You Received)</option>
                    <option value="IN">Cash Out (You Gave)</option>
                  </select>
                </div>

                {/* Party filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Party <span className="text-slate-400 font-normal normal-case">(from current book's entries)</span>
                  </label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={crossParty} onChange={e => setCrossParty(e.target.value)}>
                    <option value="">All Parties</option>
                    {[...new Set(entries.map((e: any) => e.partyName).filter(Boolean))].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">From Date</label>
                    <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={crossDateFrom} onChange={e => setCrossDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">To Date</label>
                    <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={crossDateTo} onChange={e => setCrossDateTo(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Summary of what will be exported */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Report will include:</p>
                <p>📚 Entries from <strong>all {books.length} cashbook{books.length !== 1 ? 's' : ''}</strong></p>
                {crossCategory && <p>📂 Category: <strong>{crossCategory}</strong></p>}
                {crossParty    && <p>👤 Party: <strong>{crossParty}</strong></p>}
                {crossType     && <p>💱 Type: <strong>{crossType === 'OUT' ? 'Cash In' : 'Cash Out'}</strong></p>}
                {(crossDateFrom || crossDateTo) && <p>📅 Date: <strong>{crossDateFrom || '—'} to {crossDateTo || '—'}</strong></p>}
                {!crossCategory && !crossParty && !crossType && !crossDateFrom && !crossDateTo && <p className="text-slate-400 italic">All entries (no filter applied)</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCrossModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={() => handleCrossExport('csv')} disabled={crossLoading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60">
                  {crossLoading ? 'Preparing...' : '↓ Export CSV'}
                </button>
                <button type="button" onClick={() => handleCrossExport('pdf')} disabled={crossLoading}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60">
                  {crossLoading ? 'Preparing...' : '↓ Export PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Entry Drawer ── */}
      <EntryDrawer
        open={drawer.open}
        onClose={() => { setDrawer({ open: false }); setError('') }}
        siteId={siteId}
        cashbookId={selectedBook ?? ''}
        initialData={drawer.entry}
        customFields={customFields}
        allPaymentModes={allPaymentModes}
        allCategories={allCategories}
        parties={parties}
        onPartyAdded={p => setParties(prev => [...prev, p])}
        onSave={handleSaveEntry}
        onAddPaymentMode={handleAddPaymentMode}
        onAddCategory={handleAddCategory}
      />

      {/* ── Modals ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

            {/* Create/Edit Book */}
            {modal === 'book' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg">{editingBook ? 'Edit Cashbook' : 'New Cashbook'}</h3>
                  <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
                </div>
                {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                <form onSubmit={handleBookForm} className="space-y-4">
                  <div><label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Book Name *</label><input name="name" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" required defaultValue={editingBook?.name ?? ''} placeholder="e.g. Main Account, Petty Cash" /></div>
                  <div><label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Description</label><input name="description" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" defaultValue={editingBook?.description ?? ''} placeholder="Optional description" /></div>
                  <div className="flex gap-3 pt-2">
                    {editingBook && <button type="button" onClick={handleDeleteBook} className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">Delete</button>}
                    <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60">{loading ? '...' : editingBook ? 'Save' : 'Create'}</button>
                  </div>
                </form>
              </div>
            )}

            {/* Settings */}
            {modal === 'settings' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg">Book Settings</h3>
                  <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
                </div>
                {ok && <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">✓ {ok}</div>}
                {error && <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">{error}</div>}

                {/* Custom Fields */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center justify-between">
                    Custom Fields ({customFields.length})
                    <button type="button" onClick={() => { setEditingField(null); setCfLabel(''); setCfType('TEXT'); setCfRequired(false); setCfOptions([]) }} className="text-xs text-blue-600 hover:underline">+ Add Field</button>
                  </h4>
                  {(editingField !== undefined || cfLabel) && (
                    <div className="p-3 bg-blue-50 rounded-xl space-y-3 border border-blue-200">
                      <p className="text-xs font-bold text-blue-800">{editingField ? 'Edit Field' : 'New Field'}</p>
                      <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Field label *" value={cfLabel} onChange={e => setCfLabel(e.target.value)} />
                      <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none" value={cfType} onChange={e => setCfType(e.target.value)}>
                        {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {cfType === 'DROPDOWN' && (
                        <div className="space-y-1.5">
                          {cfOptions.map((o, i) => (
                            <div key={i} className="flex gap-2">
                              <input className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-900" value={o} onChange={e => setCfOptions(p => p.map((v, j) => j === i ? e.target.value : v))} />
                              <button type="button" onClick={() => setCfOptions(p => p.filter((_, j) => j !== i))} className="text-red-500 text-xs px-2">✕</button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <input className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-900 placeholder-slate-400" placeholder="Add option..." value={cfOptInput} onChange={e => setCfOptInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && cfOptInput.trim()) { setCfOptions(p => [...p, cfOptInput.trim()]); setCfOptInput(''); e.preventDefault() } }} />
                            <button type="button" onClick={() => { if (cfOptInput.trim()) { setCfOptions(p => [...p, cfOptInput.trim()]); setCfOptInput('') } }} className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-semibold">Add</button>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="cf-req" className="accent-blue-600" checked={cfRequired} onChange={e => setCfRequired(e.target.checked)} />
                        <label htmlFor="cf-req" className="text-xs text-slate-700 font-medium cursor-pointer">Required</label>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setEditingField(null); setCfLabel(''); setCfOptions([]) }} className="flex-1 text-xs py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold">Cancel</button>
                        <button type="button" onClick={saveCustomField} disabled={loading || !cfLabel.trim()} className="flex-1 text-xs py-2 rounded-lg bg-blue-600 text-white font-bold disabled:opacity-50">{loading ? '...' : 'Save'}</button>
                      </div>
                    </div>
                  )}
                  {customFields.map(cf => (
                    <div key={cf.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-slate-900 text-sm font-semibold">{cf.label}</span>
                        <span className="ml-2 text-slate-500 text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5">{cf.fieldType}</span>
                        {cf.required && <span className="ml-1 text-red-500 text-xs">*</span>}
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => { setEditingField(cf); setCfLabel(cf.label); setCfType(cf.fieldType); setCfRequired(!!cf.required); setCfOptions(cf.options ? JSON.parse(cf.options) : []) }}
                          className="text-xs px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold hover:bg-blue-100">Edit</button>
                        <button type="button" onClick={() => deleteCustomFieldItem(cf.id)} className="text-xs px-2.5 py-1 rounded bg-red-50 border border-red-200 text-red-700 font-semibold hover:bg-red-100">Del</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Parties */}
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <h4 className="font-bold text-slate-800 text-sm">Parties ({parties.length})</h4>
                  {parties.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div><span className="text-slate-900 text-sm font-semibold">{p.name}</span>{p.type && <span className="ml-2 text-slate-400 text-xs">{p.type}</span>}</div>
                      <button type="button" onClick={async () => { if (!confirm(`Remove "${p.name}"?`)) return; await deleteParty(p.id, siteId); setParties(prev => prev.filter(x => x.id !== p.id)); flash('Removed') }} className="text-xs px-2 py-1 rounded bg-red-50 border border-red-200 text-red-600 font-semibold">✕</button>
                    </div>
                  ))}
                </div>

                {/* Payment modes */}
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <h4 className="font-bold text-slate-800 text-sm">Custom Payment Modes</h4>
                  {customPMs.map((m, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-900 text-sm font-semibold">{m}</span>
                      <button type="button" onClick={async () => { await deleteCustomPaymentMethod(initialCustomPaymentMethods.find((x:any) => x.name === m)?.id, siteId); setCustomPMs(prev => prev.filter(x => x !== m)); flash('Removed') }} className="text-xs px-2 py-1 rounded bg-red-50 border border-red-200 text-red-600 font-semibold">✕</button>
                    </div>
                  ))}
                  <p className="text-xs text-slate-400 italic">Add new modes from the entry form payment mode dropdown</p>
                </div>
              </div>
            )}

            {/* View Entry */}
            {modal === 'view' && viewEntry && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${viewEntry.type === 'OUT' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <h3 className="font-bold text-slate-900 text-lg">{viewEntry.type === 'OUT' ? 'Cash In' : 'Cash Out'}</h3>
                  </div>
                  <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
                </div>
                <div className={`text-3xl font-bold ${viewEntry.type === 'OUT' ? 'text-green-700' : 'text-red-600'}`}>
                  {viewEntry.type === 'OUT' ? '' : '-'}₹{fmtAmt(viewEntry.amount)}
                </div>
                {[
                  ['Date', fmtDateTime(viewEntry.date)],
                  ['Details', viewEntry.description],
                  ['Party', viewEntry.partyName],
                  ['Category', viewEntry.category],
                  ['Mode', viewEntry.paymentMode],
                  ['Reference', viewEntry.reference],
                  viewEntry.lpoNumber && ['LPO Number', viewEntry.lpoNumber],
                ].filter(Boolean).map(([k, v]: any) => v ? (
                  <div key={k} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-slate-500 text-sm">{k}</span>
                    <span className="text-slate-900 text-sm font-semibold text-right">{v}</span>
                  </div>
                ) : null)}
                {viewEntry.proofUrl && (
                  <a href={viewEntry.proofUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-700 text-sm font-semibold hover:underline pt-1">
                    📎 View Attached Bill / Proof
                  </a>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setModal(null); setDrawer({ open: true, entry: viewEntry }) }} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">Edit</button>
                  <button type="button" onClick={() => { handleDeleteEntry(viewEntry.id); setModal(null) }} className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">Delete</button>
                </div>
              </div>
            )}

            {/* Access */}
            {modal === 'access' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg">Book Access</h3>
                  <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
                </div>
                <p className="text-slate-500 text-xs">These users can access only this cashbook and nothing else in the system.</p>
                {error && <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">{error}</div>}
                {ok && <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">✓ {ok}</div>}
                {accessList.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div><p className="text-slate-900 text-sm font-semibold">{a.name}</p><p className="text-slate-400 text-xs">{a.email}</p></div>
                    <button type="button" onClick={async () => { await deleteCashbookAccess(a.id, siteId); setAccessList(prev => prev.filter(x => x.id !== a.id)); flash('Revoked') }} className="text-xs px-2.5 py-1 rounded bg-red-50 border border-red-200 text-red-700 font-semibold">Revoke</button>
                  </div>
                ))}
                <form onSubmit={handleAddAccess} className="space-y-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Create New Access</p>
                  <input name="name" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" required placeholder="Full name" />
                  <input name="email" type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" required placeholder="Email" />
                  <input name="password" type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" required minLength={6} placeholder="Password (min 6 chars)" />
                  <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60">{loading ? '...' : 'Create Access'}</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
