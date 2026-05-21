'use client'

import { useState, useRef } from 'react'
import { createIdealRule } from '@/actions/materials'

export function IdealRulesView({ siteId, rules, workTypes, materials }: {
  siteId: string
  rules: any[]
  workTypes: any[]
  materials: any[]
}) {
  const [showAdd, setShowAdd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [ok, setOk]             = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function flash(msg: string) { setOk(msg); setTimeout(() => setOk(''), 4000) }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('siteId', siteId)
    const result = await createIdealRule(fd)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    flash('Rule added!'); setShowAdd(false);
    (e.target as HTMLFormElement).reset()
    window.location.reload()
  }

  // Download Excel template
  function downloadTemplate() {
    // Build CSV that Excel can open
    const header = ['Work Type Name', 'Work Type Unit', 'Material Name', 'Material Unit', 'Ideal Qty Per Unit of Work', 'Description']
    const examples = [
      ['Concrete Pouring', 'm³', 'OPC Cement (50kg)', 'bags', '6.5', '6.5 bags cement per m³'],
      ['Concrete Pouring', 'm³', 'River Sand', 'm³', '0.45', '0.45 m³ sand per m³'],
      ['Brickwork', 'm²', 'Hollow Block 20cm', 'pcs', '12.5', '12.5 blocks per m²'],
    ]
    const csv = [header, ...examples].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'ideal-rules-template.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Import Excel/CSV
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setError('')

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      const rows  = lines.slice(1) // skip header

      let added = 0; let skipped = 0

      for (const row of rows) {
        // Parse CSV row (handle quoted fields)
        const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, '').trim())
        if (cols.length < 5) { skipped++; continue }

        const [wtName, wtUnit, matName, matUnit, idealQtyStr, desc] = cols
        if (!wtName || !matName || !idealQtyStr) { skipped++; continue }

        const idealQty = parseFloat(idealQtyStr)
        if (isNaN(idealQty) || idealQty <= 0) { skipped++; continue }

        // Find or note work type and material by name
        const wt  = workTypes.find(w => w.name.toLowerCase() === wtName.toLowerCase())
        const mat = materials.find(m => m.name.toLowerCase() === matName.toLowerCase())

        if (!wt || !mat) { skipped++; continue }

        const fd = new FormData()
        fd.set('siteId', siteId)
        fd.set('workTypeId', wt.id)
        fd.set('materialId', mat.id)
        fd.set('idealQtyPer', String(idealQty))
        fd.set('description', desc || `${idealQty} ${mat.unit} per ${wt.unit}`)

        const result = await createIdealRule(fd)
        if (!result?.error) added++; else skipped++
      }

      setImporting(false)
      flash(`Imported ${added} rules. ${skipped > 0 ? `${skipped} skipped (work type or material not found in this site).` : ''}`)
      if (fileRef.current) fileRef.current.value = ''
      window.location.reload()
    } catch (err: any) {
      setImporting(false)
      setError('Import failed: ' + (err?.message ?? 'Unknown error'))
    }
  }

  return (
    <div className="space-y-5">
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">{error}</div>}
      {ok    && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">✓ {ok}</div>}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-slate-600 text-sm">{rules.length} rules configured for this site</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadTemplate}
            className="btn-secondary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Template
          </button>
          <label className={`btn-secondary text-sm flex items-center gap-2 cursor-pointer ${importing ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? 'Importing...' : 'Import CSV/Excel'}
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
          <button onClick={() => setShowAdd(!showAdd)} className="btn text-sm">+ Add Rule</button>
        </div>
      </div>

      {/* Import guide */}
      <div className="card p-4 bg-blue-50 border-blue-200 space-y-2">
        <h4 className="font-bold text-blue-900 text-sm">📥 How to Import Rules via Excel/CSV</h4>
        <ol className="text-blue-800 text-xs space-y-1 list-decimal pl-4">
          <li>Click <strong>Download Template</strong> to get the correct column format</li>
          <li>Fill in your rules — work type and material names must match exactly what's added to this site</li>
          <li>Save as CSV and click <strong>Import CSV/Excel</strong></li>
        </ol>
        <p className="text-blue-700 text-xs font-medium">
          Columns: Work Type Name · Work Type Unit · Material Name · Material Unit · Ideal Qty Per Unit · Description
        </p>
      </div>

      {/* Add rule form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="card p-5 border-2 border-orange-200 space-y-4">
          <h3 className="font-bold text-slate-900">Add Ideal Rule</h3>
          <p className="text-slate-500 text-xs">
            Define how much material should ideally be used per unit of work.
            e.g. 6.5 bags of cement per 1 m³ of concrete poured.
          </p>
          <div>
            <label className="label">Work Type *</label>
            <select name="workTypeId" className="input" required>
              <option value="">Select work type...</option>
              {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Material *</label>
            <select name="materialId" className="input" required>
              <option value="">Select material...</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Ideal Quantity per Unit of Work *</label>
            <input name="idealQtyPer" type="number" step="0.001" min="0.001" className="input" required placeholder="e.g. 6.5" />
            <p className="text-slate-500 text-xs mt-1">How much material is needed for 1 unit of the selected work type</p>
          </div>
          <div>
            <label className="label">Description</label>
            <input name="description" className="input" placeholder="e.g. 6.5 bags cement per m³ concrete" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">{loading ? 'Saving...' : 'Save Rule'}</button>
          </div>
        </form>
      )}

      {/* Rules list */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-sm">Configured Rules</h3>
        </div>
        {rules.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500 text-sm mb-1">No ideal rules yet</p>
            <p className="text-slate-400 text-xs mb-4">Add rules to track material consumption against ideal quantities</p>
            <div className="flex gap-2 justify-center">
              <button onClick={downloadTemplate} className="btn-secondary text-sm">Download Template</button>
              <button onClick={() => setShowAdd(true)} className="btn text-sm">Add Manually</button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rules.map((rule: any, i: number) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="badge badge-orange text-xs">{rule.workType?.name ?? rule.workTypeName}</span>
                    <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="badge badge-blue text-xs">{rule.material?.name ?? rule.materialName}</span>
                  </div>
                  <p className="text-slate-500 text-xs">{rule.description ?? ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-slate-900 font-bold text-sm">
                    {rule.idealQtyPer ?? rule.idealQty}
                    <span className="text-slate-500 font-normal text-xs ml-1">{rule.material?.unit ?? rule.unit}</span>
                  </p>
                  <p className="text-slate-400 text-xs">per {rule.workType?.unit ?? rule.workUnit}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
