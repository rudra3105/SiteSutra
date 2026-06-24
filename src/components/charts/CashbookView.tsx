'use client'

import React, { useState, useEffect, useMemo, useRef, useContext, useCallback } from 'react'
import {
  createCashbook, updateCashbook, deleteCashbook,
  addCashbookEntry, updateCashbookEntry, deleteCashbookEntry,
  getParties, createParty, updateParty, deleteParty,
  getCustomFields, createCustomField, updateCustomField, deleteCustomField,
  getCustomPaymentMethods, createCustomPaymentMethod, renameCustomPaymentMethod, deleteCustomPaymentMethod,
  getCashbookAccessList, createCashbookAccess, deleteCashbookAccess,
  getAllEntriesBySite, renameCategory, deleteCategory,
} from '@/actions/cashbook'

// ── Constants ─────────────────────────────────────────────────
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
function fmtDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function partyLabel(name: string | null | undefined, parties: any[]): string {
  if (!name) return ''
  const phone = parties.find(p => p.name === name)?.phone
  return phone ? `${name} (${phone})` : name
}

// ── Custom Confirm Modal (replaces window.confirm) ─────────────
type ConfirmOpts = { title?: string; danger?: boolean; confirmLabel?: string; cancelLabel?: string }
const ConfirmContext = React.createContext<(message: string, opts?: ConfirmOpts) => Promise<boolean>>(
  async () => true
)
function useConfirm() { return useContext(ConfirmContext) }

function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ message: string; opts?: ConfirmOpts; resolve: (v: boolean) => void } | null>(null)

  const confirmFn = useCallback((message: string, opts?: ConfirmOpts) => {
    return new Promise<boolean>(resolve => setState({ message, opts, resolve }))
  }, [])

  function close(result: boolean) {
    state?.resolve(result)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirmFn}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40" onClick={() => close(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${state.opts?.danger !== false ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zM12 15.75h.008" /></svg>
              </div>
              <div className="flex-1 pt-1">
                <h3 className="font-bold text-slate-900 text-sm">{state.opts?.title ?? 'Are you sure?'}</h3>
                <p className="text-slate-600 text-sm mt-1">{state.message}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => close(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50">
                {state.opts?.cancelLabel ?? 'Cancel'}
              </button>
              <button type="button" onClick={() => close(true)} autoFocus
                className={`flex-1 py-2.5 rounded-lg text-white text-sm font-bold ${state.opts?.danger !== false ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {state.opts?.confirmLabel ?? 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

// ── Editable Dropdown (search + add new + edit/delete options) ─
function EditableDropdown({
  options, value, onChange, placeholder = 'Select...', onAddOption, onEditOption, onDeleteOption,
}: {
  options: string[]; value: string; onChange: (v: string) => void
  placeholder?: string; onAddOption?: (v: string) => Promise<void>
  onEditOption?: (oldVal: string, newVal: string) => Promise<void>
  onDeleteOption?: (val: string) => Promise<void>
}) {
  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState('')
  const [adding, setAdding]   = useState(false)
  const [editingOpt, setEditingOpt] = useState<string | null>(null)
  const [editValue, setEditValue]   = useState('')
  const [busyOpt, setBusyOpt] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const confirmDialog = useConfirm()

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setEditingOpt(null) } }
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

  async function handleSaveEdit(oldVal: string) {
    if (!onEditOption || !editValue.trim() || editValue.trim() === oldVal) { setEditingOpt(null); return }
    setBusyOpt(oldVal)
    await onEditOption(oldVal, editValue.trim())
    if (value === oldVal) onChange(editValue.trim())
    setBusyOpt(null); setEditingOpt(null)
  }

  async function handleDelete(o: string) {
    if (!onDeleteOption) return
    const ok = await confirmDialog(`Delete "${o}"? This will remove it from all existing entries.`, { confirmLabel: 'Delete' })
    if (!ok) return
    setBusyOpt(o)
    await onDeleteOption(o)
    if (value === o) onChange('')
    setBusyOpt(null)
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
            {filtered.map(o => editingOpt === o ? (
              <div key={o} className="flex items-center gap-1 px-2 py-1.5 bg-blue-50">
                <input autoFocus className="flex-1 text-sm px-2 py-1 rounded border border-blue-300 bg-white text-slate-900 focus:outline-none"
                  value={editValue} onChange={e => setEditValue(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleSaveEdit(o); if (e.key === 'Escape') setEditingOpt(null) }} />
                <button type="button" disabled={busyOpt === o} onClick={e => { e.stopPropagation(); handleSaveEdit(o) }}
                  className="text-xs px-2 py-1 rounded bg-blue-600 text-white font-semibold disabled:opacity-50">✓</button>
                <button type="button" onClick={e => { e.stopPropagation(); setEditingOpt(null) }}
                  className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-500">✕</button>
              </div>
            ) : (
              <div key={o} className={`group flex items-center hover:bg-blue-50 transition-colors ${value === o ? 'bg-blue-50' : ''}`}>
                <button type="button" onClick={() => { onChange(o); setOpen(false); setSearch('') }}
                  className={`flex-1 text-left px-3 py-2 text-sm truncate ${value === o ? 'text-blue-700 font-semibold' : 'text-slate-900'}`}>
                  {o}
                </button>
                {(onEditOption || onDeleteOption) && (
                  <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEditOption && (
                      <button type="button" title="Rename" disabled={busyOpt === o}
                        onClick={e => { e.stopPropagation(); setEditingOpt(o); setEditValue(o) }}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                    )}
                    {onDeleteOption && (
                      <button type="button" title="Delete" disabled={busyOpt === o}
                        onClick={e => { e.stopPropagation(); handleDelete(o) }}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-100">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
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
function PartySelector({ parties, value, onChange, onPartyAdded, siteId, cashbookId, onEditParty, onDeleteParty }: {
  parties: any[]; value: string; onChange: (v: string) => void
  onPartyAdded: (p: any) => void; siteId: string; cashbookId: string
  onEditParty?: (p: any) => Promise<void>; onDeleteParty?: (p: any) => Promise<void>
}) {
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newType, setNewType]   = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [adding, setAdding]     = useState(false)
  const [err, setErr]           = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [editType, setEditType]   = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [busyId, setBusyId]       = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const confirmDialog = useConfirm()

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowAdd(false); setEditingId(null) } }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = parties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  const selectedPhone = parties.find(p => p.name === value)?.phone

  async function doAdd() {
    if (!newName.trim()) { setErr('Name required'); return }
    setAdding(true); setErr('')
    try {
      const r = await createParty(cashbookId, siteId, newName.trim(), newType || undefined, newPhone || undefined)
      if (!r) { setErr('No response'); setAdding(false); return }
      if (r.error) { setErr(r.error); setAdding(false); return }
      const p = { id: r.id, name: r.name ?? newName.trim(), type: newType, phone: newPhone }
      onPartyAdded(p); onChange(p.name)
      setNewName(''); setNewType(''); setNewPhone(''); setShowAdd(false); setOpen(false); setSearch('')
    } catch (e: any) { setErr(e?.message ?? 'Error') }
    setAdding(false)
  }

  async function doSaveEdit(p: any) {
    if (!onEditParty || !editName.trim()) { setEditingId(null); return }
    setBusyId(p.id)
    await onEditParty({ ...p, name: editName.trim(), type: editType, phone: editPhone })
    if (value === p.name) onChange(editName.trim())
    setBusyId(null); setEditingId(null)
  }

  async function doDelete(p: any) {
    if (!onDeleteParty) return
    const ok = await confirmDialog(`Delete party "${p.name}"? It will be removed from all existing entries.`, { confirmLabel: 'Delete' })
    if (!ok) return
    setBusyId(p.id)
    await onDeleteParty(p)
    if (value === p.name) onChange('')
    setBusyId(null)
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-left text-sm flex items-center justify-between bg-white hover:border-blue-400 focus:outline-none min-h-[38px]">
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>{value ? `${value}${selectedPhone ? ` (${selectedPhone})` : ''}` : 'Select party...'}</span>
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
            {filtered.map(p => editingId === p.id ? (
              <div key={p.id} className="p-2.5 space-y-1.5 bg-blue-50">
                <input autoFocus className="w-full text-sm px-2 py-1.5 rounded border border-blue-300 bg-white text-slate-900 focus:outline-none"
                  value={editName} onChange={e => setEditName(e.target.value)} onClick={e => e.stopPropagation()}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') doSaveEdit(p); if (e.key === 'Escape') setEditingId(null) }} placeholder="Party name" />
                <div className="grid grid-cols-2 gap-1.5">
                  <select className="text-xs px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-900" value={editType} onChange={e => setEditType(e.target.value)} onClick={e => e.stopPropagation()}>
                    <option value="">Type</option>
                    {PARTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="text-xs px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-900" value={editPhone} onChange={e => setEditPhone(e.target.value)} onClick={e => e.stopPropagation()} placeholder="Phone" />
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={e => { e.stopPropagation(); setEditingId(null) }} className="flex-1 text-xs py-1.5 rounded border border-slate-300 bg-white text-slate-700 font-semibold">Cancel</button>
                  <button type="button" disabled={busyId === p.id} onClick={e => { e.stopPropagation(); doSaveEdit(p) }} className="flex-1 text-xs py-1.5 rounded bg-blue-600 text-white font-bold disabled:opacity-50">Save</button>
                </div>
              </div>
            ) : (
              <div key={p.id} className={`group flex items-center hover:bg-blue-50 transition-colors ${value === p.name ? 'bg-blue-50' : ''}`}>
                <button type="button" onClick={() => { onChange(p.name); setOpen(false); setSearch('') }}
                  className="flex-1 text-left px-3 py-2.5 flex items-center justify-between min-w-0">
                  <span className="text-slate-900 text-sm font-semibold truncate">{p.name}{p.phone && <span className="text-slate-400 font-normal"> ({p.phone})</span>}</span>
                  {p.type && <span className="text-slate-400 text-xs bg-slate-100 px-2 py-0.5 rounded flex-shrink-0 ml-1">{p.type}</span>}
                </button>
                {(onEditParty || onDeleteParty) && (
                  <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {onEditParty && (
                      <button type="button" title="Rename" disabled={busyId === p.id}
                        onClick={e => { e.stopPropagation(); setEditingId(p.id); setEditName(p.name); setEditType(p.type ?? ''); setEditPhone(p.phone ?? '') }}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                    )}
                    {onDeleteParty && (
                      <button type="button" title="Delete" disabled={busyId === p.id}
                        onClick={e => { e.stopPropagation(); doDelete(p) }}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-100">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
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
function ProofUpload({ value, onChange, onUploadingChange }: { value: string; onChange: (url: string) => void; onUploadingChange?: (uploading: boolean) => void }) {
  const [uploading, setUploading] = useState(false)
  const [err, setErr]             = useState('')
  const [fileName, setFileName]   = useState('')
  const ref = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); onUploadingChange?.(true); setErr('')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false); onUploadingChange?.(false)
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
  open, onClose, siteId, cashbookId, initialData, entryType, customFields, allPaymentModes, allCategories, parties, onPartyAdded, onSave,
  onAddPaymentMode, onAddCategory, onEditPaymentMode, onDeletePaymentMode, onEditCategory, onDeleteCategory, onEditParty, onDeleteParty,
}: {
  open: boolean; onClose: () => void; siteId: string; cashbookId: string; initialData?: any; entryType: 'IN' | 'OUT'
  customFields: any[]; allPaymentModes: string[]; allCategories: string[]; parties: any[]
  onPartyAdded: (p: any) => void; onSave: (data: any, addAnother?: boolean) => void; onAddPaymentMode: (v: string) => Promise<void>; onAddCategory: (v: string) => Promise<void>
  onEditPaymentMode: (oldV: string, newV: string) => Promise<void>; onDeletePaymentMode: (v: string) => Promise<void>
  onEditCategory: (oldV: string, newV: string) => Promise<void>; onDeleteCategory: (v: string) => Promise<void>
  onEditParty: (p: any) => Promise<void>; onDeleteParty: (p: any) => Promise<void>
}) {
  const [partyName, setPartyName]     = useState(initialData?.partyName ?? '')
  const [proofUrl, setProofUrl]       = useState(initialData?.proofUrl ?? '')
  const [mediaUploading, setMediaUploading] = useState(false)
  const [category, setCategory]       = useState(initialData?.category ?? '')
  const [paymentMode, setPaymentMode] = useState(initialData?.paymentMode ?? '')
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    initialData?.customFieldValues
      ? (typeof initialData.customFieldValues === 'string' ? JSON.parse(initialData.customFieldValues) : initialData.customFieldValues)
      : {}
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (initialData) {
      setPartyName(initialData.partyName ?? '')
      setProofUrl(initialData.proofUrl ?? '')
      setCategory(initialData.category ?? '')
      setPaymentMode(initialData.paymentMode ?? 'Cash')
      setCustomValues(initialData.customFieldValues
        ? (typeof initialData.customFieldValues === 'string' ? JSON.parse(initialData.customFieldValues) : initialData.customFieldValues)
        : {})
    } else {
      setPartyName(''); setProofUrl(''); setCategory(''); setPaymentMode(''); setCustomValues({})
    }
    setError('')
  }, [initialData, open])

  if (!open) return null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data: any = Object.fromEntries(fd)
    data.type = entryType
    data.partyName   = partyName  || null
    data.proofUrl    = proofUrl   || null
    data.category    = category   || null
    data.paymentMode = paymentMode || null
    if (Object.keys(customValues).length > 0) {
      data.customFieldValues = customValues
    }
    const addAnother = !!(e as any).addAnother
    setLoading(true); setError('')
    Promise.resolve(onSave(data, addAnother)).finally(() => setLoading(false))
  }

  const typeInfo = ENTRY_TYPES.find(t => t.value === entryType)!

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* Drawer */}
      <div className="relative bg-white w-full max-w-md h-full overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 text-base">{initialData ? 'Edit Entry' : 'Add Entry'}</h2>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${typeInfo.bg} ${typeInfo.color} border-current`}>
              <span className={`w-1.5 h-1.5 rounded-full ${typeInfo.dot}`} />
              {typeInfo.label}
            </span>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Amount (₹) *</label>
            <input name="amount" type="number" required min="0.01" step="0.01"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00" defaultValue={initialData?.amount ?? ''} />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Date *</label>
            <input name="date" type="date" required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              defaultValue={initialData?.date ? initialData.date.slice(0, 10) : new Date().toISOString().slice(0, 10)} />
          </div>

          {/* Party */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Party Name</label>
            <PartySelector parties={parties} value={partyName} onChange={setPartyName} onPartyAdded={onPartyAdded} siteId={siteId} cashbookId={cashbookId}
              onEditParty={onEditParty} onDeleteParty={onDeleteParty} />
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
            <EditableDropdown options={allCategories} value={category} onChange={setCategory} placeholder="Select or add category..."
              onAddOption={onAddCategory} onEditOption={onEditCategory} onDeleteOption={onDeleteCategory} />
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Mode</label>
            <EditableDropdown options={allPaymentModes} value={paymentMode} onChange={setPaymentMode} placeholder="Select payment mode..."
              onAddOption={onAddPaymentMode} onEditOption={onEditPaymentMode} onDeleteOption={onDeletePaymentMode} />
          </div>

          {/* Reference */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Reference / Invoice No</label>
            <input name="reference" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="INV-001 (optional)" defaultValue={initialData?.reference ?? ''} />
          </div>

          {/* Bill/Proof */}
          <ProofUpload value={proofUrl} onChange={setProofUrl} onUploadingChange={setMediaUploading} />

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
        </div>

          <div className="flex gap-2 p-4 border-t border-slate-200 bg-white flex-shrink-0 flex-wrap">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors">Cancel</button>
            {!initialData && (
              <button type="button" disabled={loading || mediaUploading}
                onClick={e => { const form = (e.currentTarget as HTMLElement).closest('form') as HTMLFormElement | null; if (form) { const ev = new Event('submit', {bubbles:true,cancelable:true}); Object.defineProperty(ev,'addAnother',{value:true}); form.dispatchEvent(ev) } }}
                className="flex-1 py-2.5 rounded-xl border-2 border-blue-400 text-blue-700 font-bold text-sm hover:bg-blue-50 transition-colors disabled:opacity-60">
                + Save & Add Another
              </button>
            )}
            <button type="submit" disabled={loading || mediaUploading}
              className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-60 ${entryType === 'OUT' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {loading ? 'Saving...' : mediaUploading ? 'Uploading...' : initialData ? 'Update' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Export helpers ────────────────────────────────────────────
function entryDateRange(entries: any[]) {
  const dates = entries.map(e => e.date).filter(Boolean).sort()
  if (!dates.length) return { from: '', to: '' }
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return { from: fmt(dates[0]), to: fmt(dates[dates.length - 1]) }
}
function fmtOrDash(n: number | null | undefined) {
  return n ? fmtAmt(n) : '-'
}

async function exportToExcel(entries: any[], bookName: string, parties: any[] = [], siteName: string = '') {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Cashbook')

  sheet.columns = [
    { key: 'date',     width: 14 },
    { key: 'name',     width: 18 },
    { key: 'payment',  width: 12 },
    { key: 'remark',   width: 28 },
    { key: 'category', width: 16 },
    { key: 'income',   width: 16 },
    { key: 'expense',  width: 16 },
    { key: 'balance',  width: 16 },
  ]
  const NCOLS = 8
  const now = new Date()
  const generatedAt = `${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}`
  const { from, to } = entryDateRange(entries)

  const thin = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } }
  const allBorder = { top: thin, bottom: thin, left: thin, right: thin }
  function mergeRow(rowIdx: number, value: string, opts: { bold?: boolean; size?: number; italic?: boolean; color?: string } = {}, startCol = 1) {
    sheet.mergeCells(rowIdx, startCol, rowIdx, NCOLS)
    const cell = sheet.getCell(rowIdx, startCol)
    cell.value = value
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.font = { bold: opts.bold ?? false, size: opts.size ?? 10, italic: opts.italic ?? false, color: { argb: opts.color ?? 'FF0F172A' } }
    for (let c = startCol; c <= NCOLS; c++) sheet.getCell(rowIdx, c).border = allBorder
    return cell
  }

  // ── Logo (own merged cell, separate from title text) ──
  sheet.mergeCells('A1:A3')
  sheet.getCell('A1').border = allBorder
  try {
    const res = await fetch('/logo.png')
    if (res.ok) {
      const buf = await res.arrayBuffer()
      const imageId = workbook.addImage({ buffer: buf as any, extension: 'png' })
      sheet.addImage(imageId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 46, height: 46 } })
    }
  } catch { /* logo optional */ }

  // ── Header block (rows 1-6) ──
  mergeRow(1, 'Cash Book Report', { bold: true, size: 16 }, 2)
  mergeRow(2, `Generated on - ${generatedAt}`, { size: 9, color: 'FF64748B' }, 2)
  mergeRow(3, '', {}, 2)
  mergeRow(4, siteName ? `${siteName} · ${bookName}` : bookName, { bold: true, size: 12 })
  mergeRow(5, from && to ? `Report Period: ${from} - ${to}` : '', { size: 9, color: 'FF64748B' })
  mergeRow(6, '', {})
  sheet.getRow(1).height = 26

  // ── Income / Expense / Total summary (3-col mini table) ──
  const income  = entries.filter((e: any) => e.type === 'OUT').reduce((s: number, e: any) => s + e.amount, 0)
  const expense = entries.filter((e: any) => e.type !== 'OUT').reduce((s: number, e: any) => s + e.amount, 0)
  const summaryHeaderRow = 7
  ;['Income', 'Expense', 'Total'].forEach((label, i) => {
    const cell = sheet.getCell(summaryHeaderRow, i + 1)
    cell.value = label
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center' }
    cell.border = allBorder
  })
  const GREEN = { argb: 'FF16A34A' }
  const RED   = { argb: 'FFDC2626' }
  const summaryValueRow = summaryHeaderRow + 1
  const summaryVals: [string | number, any][] = [[income, GREEN], [expense, RED], [income - expense, income - expense >= 0 ? GREEN : RED]]
  summaryVals.forEach(([val, color], i) => {
    const cell = sheet.getCell(summaryValueRow, i + 1)
    cell.value = val
    cell.numFmt = '#,##0.00'
    cell.font = { bold: true, color }
    cell.alignment = { horizontal: 'center' }
    cell.border = allBorder
  })
  for (let c = 4; c <= NCOLS; c++) { sheet.getCell(summaryHeaderRow, c).border = allBorder; sheet.getCell(summaryValueRow, c).border = allBorder }

  mergeRow(summaryValueRow + 1, '', {})
  mergeRow(summaryValueRow + 2, `Total Transactions: ${entries.length}`, { size: 10 })
  mergeRow(summaryValueRow + 3, '', {})

  // ── Table header ──
  const headerRowIdx = summaryValueRow + 4
  const headerRow = sheet.getRow(headerRowIdx)
  const headers = ['Date', 'Name', 'Payment', 'Remark', 'Category', 'Income', 'Expense', 'Balance']
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center' }
    cell.border = allBorder
  })

  let balance2 = 0
  ;[...entries].reverse().forEach(e => {
    const isOut = e.type === 'OUT'
    balance2 += isOut ? e.amount : -e.amount
    const row = sheet.addRow({
      date:     e.date ? new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
      name:     partyLabel(e.partyName, parties),
      payment:  e.paymentMode ?? '',
      remark:   e.description ?? '',
      category: e.category ?? '',
      income:   isOut ? e.amount : null,
      expense:  isOut ? null : e.amount,
      balance:  balance2,
    })
    row.eachCell({ includeEmpty: true }, cell => { cell.border = allBorder; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true } })
    row.getCell('income').font  = { bold: true, color: GREEN }
    row.getCell('expense').font = { bold: true, color: RED }
    row.getCell('balance').font = { bold: true, color: balance2 >= 0 ? GREEN : RED }
  })
  sheet.getColumn('income').numFmt  = '#,##0.00'
  sheet.getColumn('expense').numFmt = '#,##0.00'
  sheet.getColumn('balance').numFmt = '#,##0.00'

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a'); a.href = url; a.download = `${bookName}.xlsx`
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

function exportToPDF(entries: any[], bookName: string, summary: any, parties: any[] = [], siteName: string = '') {
  let balance = 0
  const logoUrl = `${window.location.origin}/logo.png`
  const now = new Date()
  const generatedAt = `${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}`
  const { from, to } = entryDateRange(entries)

  const tableRows = [...entries].reverse().map(e => {
    const isOut = e.type === 'OUT'
    balance += isOut ? e.amount : -e.amount
    return `<tr>
      <td>${e.date ? new Date(e.date).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : ''}</td>
      <td>${partyLabel(e.partyName, parties)}</td>
      <td>${e.paymentMode ?? ''}</td>
      <td>${e.description ?? ''}</td>
      <td>${e.category ?? ''}</td>
      <td style="text-align:right;color:#16a34a;font-weight:700">${isOut ? fmtAmt(e.amount) : '-'}</td>
      <td style="text-align:right;color:#dc2626;font-weight:700">${isOut ? '-' : fmtAmt(e.amount)}</td>
      <td style="text-align:right;font-weight:700">${fmtAmt(balance)}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${bookName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#0f172a;padding:24px}
  .header{display:flex;align-items:center;gap:14px;background:#f8fafc;border-radius:10px;padding:14px 18px;margin-bottom:20px}
  .logo{width:42px;height:42px;object-fit:contain;border-radius:8px;flex-shrink:0;background:#fff}
  .title{font-size:17px;font-weight:700;color:#0f172a}
  .subtitle{font-size:10px;color:#64748b;margin-top:2px}
  .book{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:2px}
  .period{font-size:11px;color:#475569;margin-bottom:16px}
  .summary{width:100%;border-collapse:collapse;margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
  .summary th{background:#f1f5f9;padding:8px 10px;text-align:center;font-size:11px;font-weight:700;color:#334155;border:1px solid #e2e8f0}
  .summary td{padding:10px;text-align:center;font-size:14px;font-weight:700;border:1px solid #e2e8f0}
  .green{color:#16a34a}.red{color:#dc2626}
  .txn-count{font-size:11px;color:#334155;font-weight:600;margin-bottom:10px}
  table.data{width:100%;border-collapse:collapse;font-size:10px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
  table.data thead tr{background:#f1f5f9}
  table.data th{padding:8px;text-align:center;font-size:9.5px;text-transform:none;font-weight:700;color:#334155;border:1px solid #e2e8f0}
  table.data td{padding:7px 8px;text-align:center;border:1px solid #e2e8f0;vertical-align:middle}
  .footer{margin-top:20px;font-size:9px;color:#94a3b8;text-align:center;padding-top:8px;border-top:1px solid #e2e8f0}
  @media print{body{padding:0}@page{margin:12mm;size:A4}}
</style></head><body>
<div class="header">
  <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" />
  <div>
    <div class="title">Cash Book Report</div>
    <div class="subtitle">Generated on ${generatedAt}</div>
  </div>
</div>
<div class="book">${siteName ? `${siteName} · ${bookName}` : bookName}</div>
${from && to ? `<div class="period">Report Period: ${from} to ${to}</div>` : ''}
<table class="summary">
  <thead><tr><th>Income</th><th>Expense</th><th>Balance</th></tr></thead>
  <tbody><tr>
    <td class="green">${fmtAmt(summary.income)}</td>
    <td class="red">${fmtAmt(summary.expense)}</td>
    <td>${fmtAmt(summary.net)}</td>
  </tr></tbody>
</table>
<div class="txn-count">Total Transactions: ${entries.length}</div>
<table class="data">
  <thead><tr><th>Date</th><th>Name</th><th>Payment</th><th>Remark</th><th>Category</th><th>Income</th><th>Expense</th><th>Balance</th></tr></thead>
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
export function CashbookView(props: {
  siteId: string; siteName?: string; initialBooks: any[]; initialParties: any[]; initialCustomPaymentMethods: any[]
}) {
  return <ConfirmProvider><CashbookViewInner {...props} /></ConfirmProvider>
}

function CashbookViewInner({ siteId, siteName = '', initialBooks, initialParties, initialCustomPaymentMethods }: {
  siteId: string; siteName?: string; initialBooks: any[]; initialParties: any[]; initialCustomPaymentMethods: any[]
}) {
  const [books, setBooks]                 = useState(initialBooks)
  const [parties, setParties]             = useState(initialParties)
  const [customPMs, setCustomPMs]         = useState<{ id: string; name: string }[]>(initialCustomPaymentMethods)
  const [customCats, setCustomCats]       = useState<string[]>([])
  const [selectedBook, setSelectedBook]   = useState<string | null>(initialBooks[0]?.id ?? null)
  const [entries, setEntries]             = useState<any[]>([])
  const [customFields, setCustomFields]   = useState<any[]>([])
  const [accessList, setAccessList]       = useState<any[]>([])
  const [page, setPage]                   = useState(1)
  const [selected, setSelected]           = useState<Set<string>>(new Set())
  const [loading, setLoading]             = useState(false)
  const [ok, setOk]                       = useState('')
  const initialLoadRef = useRef(false)
  const confirmDialog = useConfirm()

  // Modals/drawers
  const [drawer, setDrawer]     = useState<{ open: boolean; entry?: any; type?: 'IN' | 'OUT' }>({ open: false })
  const [modal, setModal]       = useState<string | null>(null) // 'newBook'|'editBook'|'settings'|'access'|'view'
  const [viewEntry, setViewEntry] = useState<any>(null)
  const [editingBook, setEditingBook] = useState<any>(null)
  const [error, setError]       = useState('')

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
  const [filterAddedBy, setFilterAddedBy]   = useState('')
  const [filterFrom, setFilterFrom]         = useState('')
  const [filterTo, setFilterTo]             = useState('')

  // Cross-book report state
  const [crossModal, setCrossModal]       = useState(false)
  const [crossCategory, setCrossCategory] = useState('')
  const [crossType, setCrossType]         = useState('')
  const [crossParty, setCrossParty]       = useState('')
  const [crossDateFrom, setCrossDateFrom] = useState('')
  const [crossDateTo, setCrossDateTo]     = useState('')
  const [crossLoading, setCrossLoading]   = useState(false)

  const allPaymentModes = [...new Set([...customPMs.map(m => m.name), ...entries.map((e: any) => e.paymentMode).filter(Boolean)])]
  const allCategories   = [...new Set([...customCats, ...entries.map((e: any) => e.category).filter(Boolean)])]

  function flash(msg: string) { setOk(msg); setTimeout(() => setOk(''), 3000) }

  async function loadBook(bookId: string) {
    setSelectedBook(bookId); setEntries([]); setPage(1); setSelected(new Set()); setParties([])
    const [entriesRes, fields, bookParties] = await Promise.all([
      fetch(`/api/cashbook/${bookId}/entries`).then(r => r.json()),
      getCustomFields(bookId),
      getParties(bookId),
    ])
    setEntries(entriesRes.entries ?? [])
    setCustomFields(fields ?? [])
    setParties(bookParties ?? [])
  }

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true
      if (selectedBook) loadBook(selectedBook)
    }
  }, [selectedBook])

  useEffect(() => {
    fetch(`/api/parties?siteId=${siteId}`).then(r => r.json())
      .then(d => { if (Array.isArray(d) && d.length > 0) setParties(d) }).catch(() => {})
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
    if (!selectedBook) return
    const ok = await confirmDialog(`Delete "${editingBook?.name}" and ALL entries? This cannot be undone.`, { confirmLabel: 'Delete Book' })
    if (!ok) return
    await deleteCashbook(selectedBook, siteId); flash('Deleted'); window.location.reload()
  }

  // ── Entry CRUD ───────────────────────────────────────────────
  async function handleSaveEntry(data: any, addAnother = false) {
    data.cashbookId = selectedBook; data.siteId = siteId
    const r = drawer.entry
      ? await updateCashbookEntry(drawer.entry.id, data, siteId)
      : await addCashbookEntry(data)
    if (r?.error) { setError(r.error); return }
    flash(drawer.entry ? 'Updated!' : 'Entry added!')
    if (addAnother) {
      // Reset drawer to fresh Add Entry (keep it open, same transaction type)
      setDrawer(d => ({ open: true, entry: undefined, type: d.type }))
    } else {
      setDrawer({ open: false })
    }
    if (selectedBook) loadBook(selectedBook)
  }

  async function handleDeleteEntry(id: string) {
    const ok = await confirmDialog('Delete this entry?', { confirmLabel: 'Delete' })
    if (!ok) return
    await deleteCashbookEntry(id, siteId)
    setEntries(prev => prev.filter(e => e.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    flash('Deleted')
  }

  async function deleteSelected() {
    const ok = await confirmDialog(`Delete ${selected.size} entries?`, { confirmLabel: 'Delete' })
    if (!ok) return
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
    const ok = await confirmDialog('Delete this field?', { confirmLabel: 'Delete' })
    if (!ok) return
    await deleteCustomField(id, siteId)
    setCustomFields(prev => prev.filter(f => f.id !== id))
    flash('Field deleted')
  }

  // ── Payment mode + category add/edit/delete ────────────────────
  async function handleAddPaymentMode(name: string) {
    const r = await createCustomPaymentMethod(siteId, name)
    if (r?.success) setCustomPMs(prev => [...prev, { id: r.id, name: r.name ?? name }])
  }
  async function handleEditPaymentMode(oldName: string, newName: string) {
    const pm = customPMs.find(m => m.name === oldName)
    if (!pm) return
    const r = await renameCustomPaymentMethod(pm.id, newName, siteId)
    if (r?.success) {
      setCustomPMs(prev => prev.map(m => m.id === pm.id ? { ...m, name: newName } : m))
      setEntries(prev => prev.map(e => e.paymentMode === oldName ? { ...e, paymentMode: newName } : e))
    }
  }
  async function handleDeletePaymentMode(name: string) {
    const pm = customPMs.find(m => m.name === name)
    if (!pm) return
    const r = await deleteCustomPaymentMethod(pm.id, siteId)
    if (r?.success) {
      setCustomPMs(prev => prev.filter(m => m.id !== pm.id))
      setEntries(prev => prev.map(e => e.paymentMode === name ? { ...e, paymentMode: null } : e))
    }
  }
  async function handleAddCategory(name: string) {
    setCustomCats(prev => [...prev, name])
    // Categories are saved per-entry, no separate table needed
  }
  async function handleEditCategory(oldName: string, newName: string) {
    if (!selectedBook) return
    const r = await renameCategory(selectedBook, oldName, newName, siteId)
    if (r?.success) {
      setCustomCats(prev => prev.map(c => c === oldName ? newName : c))
      setEntries(prev => prev.map(e => e.category === oldName ? { ...e, category: newName } : e))
    }
  }
  async function handleDeleteCategory(name: string) {
    if (!selectedBook) return
    const r = await deleteCategory(selectedBook, name, siteId)
    if (r?.success) {
      setCustomCats(prev => prev.filter(c => c !== name))
      setEntries(prev => prev.map(e => e.category === name ? { ...e, category: null } : e))
    }
  }
  async function handleEditParty(p: any) {
    const r = await updateParty(p.id, p.name, p.type, p.phone, siteId)
    if (r?.success) {
      const old = parties.find(x => x.id === p.id)
      setParties(prev => prev.map(x => x.id === p.id ? { ...x, name: p.name, type: p.type || null, phone: p.phone || null } : x))
      if (old && old.name !== p.name) setEntries(prev => prev.map(e => e.partyName === old.name ? { ...e, partyName: p.name } : e))
    }
  }
  async function handleDeleteParty(p: any) {
    const r = await deleteParty(p.id, siteId)
    if (r?.success) {
      setParties(prev => prev.filter(x => x.id !== p.id))
      setEntries(prev => prev.map(e => e.partyName === p.name ? { ...e, partyName: null } : e))
    }
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
    if (filterAddedBy && e.addedBy !== filterAddedBy) return false
    if (filterFrom && e.date < filterFrom) return false
    if (filterTo && e.date > filterTo) return false
    return true
  }), [entries, filterSearch, filterType, filterParty, filterCategory, filterMode, filterAddedBy, filterFrom, filterTo])


  // ── Cross-book report ──────────────────────────────────────
  async function handleCrossExport(format: 'excel' | 'pdf') {
    setCrossLoading(true)
    const result = await getAllEntriesBySite(siteId, {
      category: crossCategory || undefined,
      type:     crossType     || undefined,
      party:    crossParty    || undefined,
      dateFrom: crossDateFrom || undefined,
      dateTo:   crossDateTo   || undefined,
    })
    const allEntries = result.entries ?? []
    const income  = result.income  ?? 0
    const expense = result.expense ?? 0
    const net     = result.net     ?? 0
    const parts = [
      crossCategory ? `Category: ${crossCategory}` : '',
      crossParty    ? `Party: ${crossParty}`        : '',
      crossType === 'OUT' ? 'Cash In' : crossType === 'IN' ? 'Cash Out' : '',
      crossDateFrom || crossDateTo ? `${crossDateFrom||''}–${crossDateTo||''}` : '',
    ].filter(Boolean)
    const title = `All Books${parts.length ? ' — ' + parts.join(' · ') : ' — Complete Report'}`
    if (format === 'excel') await exportToExcel(allEntries, title, parties, siteName)
    else exportToPDF(allEntries, title, { income, expense, net }, parties, siteName)
    setCrossLoading(false)
    setCrossModal(false)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasFilters = filterSearch || filterType || filterParty || filterCategory || filterMode || filterAddedBy || filterFrom || filterTo

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
  const uniqueAddedBy    = [...new Set(entries.map(e => e.addedBy).filter(Boolean))]

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
              {hasFilters && <span className="text-xs text-slate-400 italic">Filtered</span>}
              <button type="button" onClick={() => exportToExcel(filtered, currentBook?.name ?? 'Cashbook', parties, siteName)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-green-700 hover:border-green-300 text-xs font-semibold transition-colors">
                ↓ Excel
              </button>
              <button type="button" onClick={() => exportToPDF(filtered, currentBook?.name ?? 'Cashbook', { income, expense, net }, parties, siteName)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-300 text-xs font-semibold transition-colors">
                ↓ PDF
              </button>
              <button type="button" onClick={() => setCrossModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-xs font-semibold transition-colors">
                📊 All Books
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
                {uniqueParties.map(p => <option key={p} value={p}>{partyLabel(p, parties)}</option>)}
              </select>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="">All Categories</option>
                {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
                <option value="">All Modes</option>
                {uniqueModes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" value={filterAddedBy} onChange={e => setFilterAddedBy(e.target.value)}>
                <option value="">All Added By</option>
                {uniqueAddedBy.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From" />
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="To" />
              {hasFilters && <button type="button" onClick={() => { setFilterSearch(''); setFilterType(''); setFilterParty(''); setFilterCategory(''); setFilterMode(''); setFilterAddedBy(''); setFilterFrom(''); setFilterTo('') }} className="text-xs text-blue-600 hover:underline font-semibold whitespace-nowrap">Clear</button>}
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
              <button type="button" onClick={() => setDrawer({ open: true, entry: undefined, type: 'OUT' })}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Cash In
              </button>
              <button type="button" onClick={() => setDrawer({ open: true, entry: undefined, type: 'IN' })}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Cash Out
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
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Daate</th>
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
                        <div className="text-xs text-slate-700 leading-relaxed">{fmtDate(e.date)}</div>
                      </td>
                      <td className="px-3 py-3 max-w-[200px]">
                        <div className="text-slate-900 font-semibold text-sm truncate">{e.description || '—'}</div>
                        {e.partyName && <div className="text-slate-500 text-xs mt-0.5">by {partyLabel(e.partyName, parties)}</div>}
                      {e.addedBy && <div className="text-slate-400 text-xs">Added by {e.addedBy}</div>}
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
                          <button type="button"
                            onClick={() => setDrawer({ open: true, entry: { ...e, id: undefined } })}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors" title="Duplicate">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
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
                  <p className="text-slate-500 text-xs mt-0.5">Export entries from all {books.length} cashbooks with filters</p>
                </div>
                <button type="button" onClick={() => setCrossModal(false)} className="text-slate-400 hover:text-slate-700 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100">✕</button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Category</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={crossCategory} onChange={e => setCrossCategory(e.target.value)}>
                    <option value="">All Categories</option>
                    {[...new Set(entries.map((e: any) => e.category).filter(Boolean))].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Transaction Type</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={crossType} onChange={e => setCrossType(e.target.value)}>
                    <option value="">All Types</option>
                    <option value="OUT">Cash In</option>
                    <option value="IN">Cash Out</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Party</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={crossParty} onChange={e => setCrossParty(e.target.value)}>
                    <option value="">All Parties</option>
                    {[...new Set(entries.map((e: any) => e.partyName).filter(Boolean))].map(p => (
                      <option key={p} value={p}>{partyLabel(p, parties)}</option>
                    ))}
                  </select>
                </div>
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

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Will include:</p>
                <p>📚 All {books.length} cashbook{books.length !== 1 ? 's' : ''}</p>
                {crossCategory && <p>📂 Category: <strong>{crossCategory}</strong></p>}
                {crossParty    && <p>👤 Party: <strong>{crossParty}</strong></p>}
                {crossType     && <p>💱 Type: <strong>{crossType === 'OUT' ? 'Cash In' : 'Cash Out'}</strong></p>}
                {(crossDateFrom || crossDateTo) && <p>📅 <strong>{crossDateFrom || '—'}</strong> to <strong>{crossDateTo || '—'}</strong></p>}
                {!crossCategory && !crossParty && !crossType && !crossDateFrom && !crossDateTo && (
                  <p className="text-slate-400 italic">All entries from all books</p>
                )}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setCrossModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={() => handleCrossExport('excel')} disabled={crossLoading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60">
                  {crossLoading ? '...' : '↓ Excel'}
                </button>
                <button type="button" onClick={() => handleCrossExport('pdf')} disabled={crossLoading}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60">
                  {crossLoading ? '...' : '↓ PDF'}
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
        entryType={drawer.entry?.type ?? drawer.type ?? 'OUT'}
        customFields={customFields}
        allPaymentModes={allPaymentModes}
        allCategories={allCategories}
        parties={parties}
        onPartyAdded={p => setParties(prev => [...prev, p])}
        onSave={handleSaveEntry}
        onAddPaymentMode={handleAddPaymentMode}
        onAddCategory={handleAddCategory}
        onEditPaymentMode={handleEditPaymentMode}
        onDeletePaymentMode={handleDeletePaymentMode}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategory}
        onEditParty={handleEditParty}
        onDeleteParty={handleDeleteParty}
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
                  ['Date', fmtDate(viewEntry.date)],
                  ['Details', viewEntry.description],
                  ['Party', partyLabel(viewEntry.partyName, parties)],
                  ['Category', viewEntry.category],
                  ['Mode', viewEntry.paymentMode],
                  ['Reference', viewEntry.reference],
                  viewEntry.lpoNumber && ['LPO Number', viewEntry.lpoNumber],
                  viewEntry.addedBy && ['Added By', viewEntry.addedBy],
                  ...(() => {
                    const vals = viewEntry.customFieldValues
                      ? (typeof viewEntry.customFieldValues === 'string' ? JSON.parse(viewEntry.customFieldValues) : viewEntry.customFieldValues)
                      : {}
                    return customFields.filter(cf => vals[cf.id]).map(cf => [cf.label, vals[cf.id]])
                  })(),
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
