'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  createCashbook, updateCashbook, deleteCashbook,
  addCashbookEntry, updateCashbookEntry, deleteCashbookEntry,
  createParty, updateParty, deleteParty,
  getCustomFields, createCustomField, updateCustomField, deleteCustomField,
  getCustomPaymentMethods, createCustomPaymentMethod, deleteCustomPaymentMethod,
  getCashbookAccessList, createCashbookAccess, deleteCashbookAccess,
} from '@/actions/cashbook'

// ── Currency formatter — full amount, no K/L ─────────────────
function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const BASE_PAYMENT_MODES = ['CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'BANK_TRANSFER']
const CATEGORIES          = ['Client Payment', 'Materials', 'Labour', 'Equipment', 'Transport', 'Rent', 'Fuel', 'Miscellaneous']
const PARTY_TYPES         = ['Client', 'Supplier', 'Contractor', 'Labour Contractor', 'Transporter', 'Other']
const FIELD_TYPES         = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN']

const ENTRY_TYPES = [
  { value: 'INCOME',  label: 'Income',  icon: '↑', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-400' },
  { value: 'EXPENSE', label: 'Expense', icon: '↓', color: 'text-red-700',     bg: 'bg-red-50 border-red-400'         },
  { value: 'LPO',     label: 'LPO',     icon: '📋', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-400'       },
]

// ── Searchable Dropdown ───────────────────────────────────────
function SearchableDropdown({
  options, value, onChange, placeholder = 'Select...', allowCustom = false, onAddNew,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  allowCustom?: boolean
  onAddNew?: (v: string) => Promise<void>
}) {
  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState('')
  const [adding, setAdding]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
  const canAdd   = allowCustom && search.trim() && !options.some(o => o.toLowerCase() === search.toLowerCase())

  async function handleAdd() {
    if (!onAddNew || !search.trim()) return
    setAdding(true)
    await onAddNew(search.trim())
    onChange(search.trim())
    setSearch(''); setOpen(false)
    setAdding(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="input flex items-center justify-between gap-2 text-left w-full">
        <span className={value ? 'text-slate-900 font-semibold' : 'text-slate-400'}>{value || placeholder}</span>
        <svg className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-slate-900 placeholder-slate-400"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && canAdd) handleAdd() }}
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {value && <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-50 italic">— Clear</button>}
            {filtered.map(o => (
              <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); setSearch('') }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-orange-50 transition-colors font-medium ${value === o ? 'bg-orange-50 text-orange-700' : 'text-slate-900'}`}>
                {o}
              </button>
            ))}
            {filtered.length === 0 && !canAdd && (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">No options found</p>
            )}
          </div>
          {allowCustom && (
            <div className="border-t border-slate-200">
              {canAdd ? (
                <button type="button" onClick={handleAdd} disabled={adding}
                  className="w-full px-3 py-2.5 text-left text-sm font-semibold text-orange-600 hover:bg-orange-50 flex items-center gap-2 transition-colors disabled:opacity-50">
                  {adding ? '⟳ Adding...' : `+ Add "${search.trim()}"`}
                </button>
              ) : (
                <p className="px-3 py-2 text-xs text-slate-400 italic">Type to add a new option</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Party Selector (no nested form) ──────────────────────────
function PartySelector({ parties, value, onChange, onPartyAdded, siteId }: {
  parties: any[]; value: string; onChange: (v: string) => void
  onPartyAdded: (p: any) => void; siteId: string
}) {
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newType, setNewType]   = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [adding, setAdding]     = useState(false)
  const [addError, setAddError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowAdd(false) } }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = parties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  async function doAdd() {
    if (!newName.trim()) { setAddError('Name required'); return }
    setAdding(true); setAddError('')
    try {
      const r = await createParty(siteId, newName.trim(), newType || undefined, newPhone || undefined)
      if (!r) { setAddError('No response — check login'); setAdding(false); return }
      if (r.error) { setAddError(r.error); setAdding(false); return }
      const p = { id: r.id, name: r.name ?? newName.trim(), type: newType, phone: newPhone }
      onPartyAdded(p); onChange(p.name)
      setNewName(''); setNewType(''); setNewPhone(''); setShowAdd(false); setOpen(false); setSearch('')
    } catch (e: any) { setAddError(e?.message ?? 'Error') }
    setAdding(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="input flex items-center justify-between gap-2 text-left w-full">
        <span className={value ? 'text-slate-900 font-semibold' : 'text-slate-400'}>{value || 'Select or add party...'}</span>
        <svg className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-slate-900 placeholder-slate-400"
              placeholder="Search party..." value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {value && <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-50 italic">— Clear</button>}
            {filtered.length === 0 && <p className="px-3 py-3 text-xs text-slate-400 text-center">{search ? `No match for "${search}"` : 'No parties yet'}</p>}
            {filtered.map(p => (
              <button key={p.id} type="button" onClick={() => { onChange(p.name); setOpen(false); setSearch('') }}
                className={`w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-orange-50 transition-colors ${value === p.name ? 'bg-orange-50' : ''}`}>
                <span className="text-slate-900 text-sm font-semibold">{p.name}</span>
                {p.type && <span className="text-slate-400 text-xs bg-slate-100 px-2 py-0.5 rounded">{p.type}</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-200">
            {!showAdd ? (
              <button type="button" onClick={() => setShowAdd(true)}
                className="w-full px-3 py-2.5 text-left text-sm font-semibold text-orange-600 hover:bg-orange-50 flex items-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Add New Party
              </button>
            ) : (
              <div className="p-3 space-y-2 bg-orange-50">
                <p className="text-xs font-bold text-orange-800">Add New Party</p>
                {addError && <p className="text-red-600 text-xs font-medium">{addError}</p>}
                <input className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-slate-900 placeholder-slate-400"
                  placeholder="Party name *" value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); doAdd() } }} />
                <div className="grid grid-cols-2 gap-2">
                  <select className="text-sm px-2 py-2 rounded-lg border border-slate-300 bg-white text-slate-900" value={newType} onChange={e => setNewType(e.target.value)}>
                    <option value="">Type (optional)</option>
                    {PARTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                    placeholder="Phone (optional)" value={newPhone} onChange={e => setNewPhone(e.target.value)} onKeyDown={e => e.stopPropagation()} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowAdd(false); setNewName(''); setAddError('') }}
                    className="flex-1 text-xs py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={doAdd} disabled={adding || !newName.trim()}
                    className="flex-1 text-xs py-2 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-50">
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

  const isPdf = value?.includes('application/pdf')
  return (
    <div>
      <label className="label">Proof / Attachment <span className="font-normal text-slate-400 normal-case">(image or PDF, max 5MB)</span></label>
      {value ? (
        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center gap-3">
          {isPdf
            ? <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></div>
            : <img src={value} alt="Proof" className="w-12 h-12 object-cover rounded-lg border border-slate-200 flex-shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 text-xs font-semibold truncate">{fileName || 'Attached file'}</p>
            <p className="text-slate-500 text-xs">{isPdf ? 'PDF document' : 'Image'}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-semibold hover:bg-blue-100">View</a>
            <button type="button" onClick={() => { onChange(''); setFileName(''); if (ref.current) ref.current.value = '' }}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold hover:bg-red-100">Remove</button>
          </div>
        </div>
      ) : (
        <label className={`flex items-center justify-center gap-3 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${uploading ? 'border-orange-300 bg-orange-50' : 'border-slate-300 hover:border-orange-400 hover:bg-orange-50'}`}>
          <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} disabled={uploading} />
          {uploading
            ? <><svg className="w-5 h-5 text-orange-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg><span className="text-orange-700 text-sm font-medium">Uploading...</span></>
            : <><svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><div className="text-center"><span className="text-slate-700 text-sm font-semibold">Click to upload</span><p className="text-slate-400 text-xs">JPG, PNG, WEBP or PDF — max 5MB</p></div></>
          }
        </label>
      )}
      {err && <p className="text-red-600 text-xs mt-1">{err}</p>}
    </div>
  )
}

// ── Entry Form (shared for Add + Edit) ────────────────────────
function EntryForm({
  siteId, cashbookId, initialData, customFields, allPaymentModes, parties,
  onPartyAdded, onSave, onCancel, loading, error,
}: {
  siteId: string; cashbookId: string; initialData?: any
  customFields: any[]; allPaymentModes: string[]; parties: any[]
  onPartyAdded: (p: any) => void; onSave: (data: any) => void
  onCancel: () => void; loading: boolean; error: string
}) {
  const [entryType, setEntryType]   = useState(initialData?.type ?? 'INCOME')
  const [partyName, setPartyName]   = useState(initialData?.partyName ?? '')
  const [proofUrl, setProofUrl]     = useState(initialData?.proofUrl ?? '')
  const [category, setCategory]     = useState(initialData?.category ?? '')
  const [paymentMode, setPaymentMode] = useState(initialData?.paymentMode ?? 'CASH')
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    initialData?.customFieldValues ? (typeof initialData.customFieldValues === 'string' ? JSON.parse(initialData.customFieldValues) : initialData.customFieldValues) : {}
  )
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data: any = Object.fromEntries(fd)
    data.type = entryType
    data.partyName = partyName || null
    data.proofUrl  = proofUrl  || null
    data.category  = category
    data.paymentMode = paymentMode
    data.customFieldValues = customValues
    onSave(data)
  }

  return (
    <div className="space-y-4">
      {/* Entry type */}
      <div className="grid grid-cols-3 gap-2">
        {ENTRY_TYPES.map(t => (
          <button key={t.value} type="button" onClick={() => setEntryType(t.value)}
            className={`p-3 rounded-xl text-xs font-bold border-2 transition-all text-center ${entryType === t.value ? `${t.bg} ${t.color} border-current` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
            <span className="block text-base mb-0.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Party */}
      <div>
        <label className="label">Party Name</label>
        <PartySelector parties={parties} value={partyName} onChange={setPartyName} onPartyAdded={onPartyAdded} siteId={siteId} />
      </div>

      {/* The actual form (no nested forms — party is outside) */}
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount (₹) *</label>
            <input name="amount" type="number" className="input" required min="0.01" step="0.01" placeholder="50000" defaultValue={initialData?.amount ?? ''} />
          </div>
          <div>
            <label className="label">Date *</label>
            <input name="date" type="date" className="input" required defaultValue={initialData?.date ?? new Date().toISOString().split('T')[0]} />
          </div>
        </div>

        <div>
          <label className="label">Description *</label>
          <input name="description" className="input" required placeholder="What is this entry for?" defaultValue={initialData?.description ?? ''} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category *</label>
            <SearchableDropdown options={CATEGORIES} value={category} onChange={setCategory} placeholder="Select category..." allowCustom onAddNew={async () => {}} />
          </div>
          <div>
            <label className="label">Payment Mode *</label>
            <SearchableDropdown options={allPaymentModes} value={paymentMode} onChange={setPaymentMode} placeholder="Select mode..." />
          </div>
        </div>

        {entryType === 'LPO' && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">LPO Number</label><input name="lpoNumber" className="input" placeholder="LPO-2024-001" defaultValue={initialData?.lpoNumber ?? ''} /></div>
            <div>
              <label className="label">LPO Status</label>
              <select name="lpoStatus" className="input" defaultValue={initialData?.lpoStatus ?? 'PENDING'}>
                <option value="PENDING">Pending</option><option value="APPROVED">Approved</option>
                <option value="RECEIVED">Received</option><option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        )}

        <div><label className="label">Reference / Invoice No</label><input name="reference" className="input" placeholder="INV-001 (optional)" defaultValue={initialData?.reference ?? ''} /></div>

        {/* Custom fields */}
        {customFields.map(cf => {
          const opts = cf.options ? JSON.parse(cf.options) : []
          return (
            <div key={cf.id}>
              <label className="label">{cf.label}{cf.required ? ' *' : ''}</label>
              {cf.fieldType === 'DROPDOWN' ? (
                <SearchableDropdown options={opts} value={customValues[cf.id] ?? ''} onChange={v => setCustomValues(prev => ({ ...prev, [cf.id]: v }))} placeholder={`Select ${cf.label}...`} allowCustom onAddNew={async () => {}} />
              ) : cf.fieldType === 'DATE' ? (
                <input type="date" className="input" value={customValues[cf.id] ?? ''} onChange={e => setCustomValues(prev => ({ ...prev, [cf.id]: e.target.value }))} required={cf.required} />
              ) : cf.fieldType === 'NUMBER' ? (
                <input type="number" className="input" value={customValues[cf.id] ?? ''} onChange={e => setCustomValues(prev => ({ ...prev, [cf.id]: e.target.value }))} placeholder={`Enter ${cf.label}`} required={cf.required} />
              ) : (
                <input type="text" className="input" value={customValues[cf.id] ?? ''} onChange={e => setCustomValues(prev => ({ ...prev, [cf.id]: e.target.value }))} placeholder={`Enter ${cf.label}`} required={cf.required} />
              )}
            </div>
          )
        })}

        {/* Proof */}
        <ProofUpload value={proofUrl} onChange={setProofUrl} />

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">
            {loading ? 'Saving...' : initialData ? 'Update Entry' : `Add ${ENTRY_TYPES.find(t => t.value === entryType)?.label}`}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Export helpers ────────────────────────────────────────────
function exportToCSV(entries: any[], bookName: string) {
  const headers = ['Date', 'Type', 'Description', 'Party', 'Category', 'Payment Mode', 'Reference', 'Amount (₹)', 'Balance (₹)']
  let balance = 0
  const rows = [...entries].reverse().map(e => {
    const amt = e.type === 'INCOME' ? e.amount : -e.amount
    balance += amt
    return [
      e.date, e.type, e.description, e.partyName ?? '', e.category,
      e.paymentMode, e.reference ?? '', e.amount.toFixed(2), balance.toFixed(2),
    ]
  })
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = `${bookName}-cashbook.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

function exportToPDF(entries: any[], bookName: string, summary: { income: number; expense: number; net: number }) {
  let balance = 0
  const rows = [...entries].reverse().map(e => {
    const amt = e.type === 'INCOME' ? e.amount : -e.amount; balance += amt
    const typeIcon = e.type === 'INCOME' ? '↑' : e.type === 'LPO' ? '📋' : '↓'
    return `<tr>
      <td>${e.date}</td><td>${typeIcon} ${e.type}</td><td>${e.description}</td>
      <td>${e.partyName ?? '—'}</td><td>${e.category}</td><td>${e.paymentMode}</td>
      <td style="text-align:right;color:${e.type==='INCOME'?'#15803d':'#dc2626'}">${e.type==='INCOME'?'+':'-'}₹${e.amount.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;font-weight:600;color:${balance>=0?'#15803d':'#dc2626'}">₹${balance.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${bookName} — Cashbook Report</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px;margin:0}
  h1{color:#ea580c;font-size:20px;margin-bottom:4px}
  .meta{color:#64748b;font-size:10px;margin-bottom:20px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
  .card{padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0}
  .card-label{font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;margin-bottom:4px}
  .card-value{font-size:18px;font-weight:700}
  .income{color:#15803d}.expense{color:#dc2626}.net{color:#1e40af}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th{background:#f97316;color:white;padding:7px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.05em}
  td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
  tr:nth-child(even) td{background:#fafafa}
  .footer{margin-top:30px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{body{padding:0}@page{margin:15mm;size:A4}}
</style></head><body>
<h1>${bookName} — Cashbook Report</h1>
<p class="meta">Generated: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; Total entries: ${entries.length}</p>
<div class="summary">
  <div class="card"><div class="card-label">Total Income</div><div class="card-value income">₹${summary.income.toLocaleString('en-IN',{minimumFractionDigits:2})}</div></div>
  <div class="card"><div class="card-label">Total Expenses + LPO</div><div class="card-value expense">₹${summary.expense.toLocaleString('en-IN',{minimumFractionDigits:2})}</div></div>
  <div class="card"><div class="card-label">Closing Balance</div><div class="card-value net" style="color:${summary.net>=0?'#15803d':'#dc2626'}">₹${summary.net.toLocaleString('en-IN',{minimumFractionDigits:2})}</div></div>
</div>
<table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Party</th><th>Category</th><th>Mode</th><th style="text-align:right">Amount</th><th style="text-align:right">Balance</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="footer">SiteSutra · Developed by Webrise Global · webriseglobal.com</div>
</body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export { fmt, SearchableDropdown, PartySelector, ProofUpload, EntryForm, exportToCSV, exportToPDF, BASE_PAYMENT_MODES, CATEGORIES, PARTY_TYPES, FIELD_TYPES, ENTRY_TYPES }
