'use client'

import { useState, Fragment } from 'react'
import {
  createSiteLocation,
  updateSiteLocation,
  updateLocationStageField,
  updateLocationRaField,
  deleteSiteLocation,
  getSiteLocations,
  createCustomBillingOption,
  renameCustomBillingOption,
  deleteCustomBillingOption,
} from '@/actions/locations'
import { createWorkLog } from '@/actions/worklogs'
import { STAGE_COLUMNS } from '@/lib/stages'

// ── Constants ─────────────────────────────────────────────────

const COLOR_CLASSES: Record<string, string> = {
  green:  'bg-emerald-50 text-emerald-700 border-emerald-300',
  yellow: 'bg-amber-50   text-amber-700   border-amber-300',
  red:    'bg-red-50     text-red-700     border-red-300',
  purple: 'bg-purple-50  text-purple-700  border-purple-300',
}
const EMPTY_CLASSES = 'bg-white text-slate-400 border-slate-200'

function optionColor(col: typeof STAGE_COLUMNS[number], value: string | null | undefined) {
  if (!value) return EMPTY_CLASSES
  const opt = col.options.find(o => o.value === value)
  return opt ? COLOR_CLASSES[opt.color] : EMPTY_CLASSES
}

// Parses tower-type strings like "PS+0", "PR+6" into a {type, angle} pair for the
// type/angle summary matrix. Non-"+" types (e.g. "B TYPE DP") bucket under angle "0".
function parseTowerType(towerType: string) {
  const t = (towerType || '').trim()
  const m = t.match(/^(.*?)\+(\d+)$/)
  if (m) return { type: m[1].trim(), angle: m[2].trim() }
  return { type: t || 'Unknown', angle: '0' }
}

// Quantity for a stage across a set of locations: tower count normally, but for
// span-measured stages (Stringing, OPGW) it's the sum of each tower's span instead —
// their progress is tracked in conductor length, not number of towers.
function stageQty(col: typeof STAGE_COLUMNS[number], locs: any[]) {
  if (col.measureBy === 'span') return locs.reduce((s, l) => s + (Number(l.span) || 0), 0)
  return locs.length
}

// ── Excel export: Locations + Progress Summary + Tower Type Summary ─────────
async function exportLocationsToExcel(locations: any[], siteName: string, billingOptions: string[]) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const thin = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } }
  const allBorder = { top: thin, bottom: thin, left: thin, right: thin }

  // ── Sheet 1: Locations — two rows per tower (main row + span row below),
  //    color-coded status cells with an in-cell dropdown, matching the source sheet look ──
  const FILL: Record<string, string> = { green: 'FF93C47D', yellow: 'FFFFD966', red: 'FFE06666', purple: 'FFB4A7D6' }
  const FONT: Record<string, string> = { green: 'FF274E13', yellow: 'FF7F6000', red: 'FF660000', purple: 'FF351C75' }

  const locSheet = workbook.addWorksheet('Locations')
  const coreHeaders = ['Sr No.', 'Loc No.', 'Tower type', 'Span']
  const stageHeaders = STAGE_COLUMNS.map(c => c.label)
  const dateHeaders  = STAGE_COLUMNS.map(c => `${c.label} Date`)
  const headers = [...coreHeaders, ...stageHeaders, ...dateHeaders]
  const headerRow = locSheet.addRow(headers)
  headerRow.eachCell(c => {
    c.font = { bold: true, size: 11, color: { argb: 'FF990000' } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border = { top: thin, bottom: { style: 'medium', color: { argb: 'FF990000' } }, left: thin, right: thin }
  })
  headerRow.height = 22

  const STAGE_COL_START = coreHeaders.length + 1 // column E
  const DATE_COL_START  = STAGE_COL_START + STAGE_COLUMNS.length

  locations.forEach((loc, i) => {
    const r1 = locSheet.rowCount + 1
    const r2 = r1 + 1

    // Row 1: Sr No / Loc No / Tower type / stage statuses / dates
    const row1Vals: (string | number)[] = [i + 1, loc.locationNo, loc.towerType, '']
    for (const col of STAGE_COLUMNS) row1Vals.push(loc[col.statusField] ?? '')
    for (const col of STAGE_COLUMNS) row1Vals.push(loc[col.dateField] ?? '')
    locSheet.addRow(row1Vals)
    // Row 2: blank Sr/Loc/Type, Span value, blank stage/date cells (kept for the merged look)
    locSheet.addRow(['', '', '', loc.span ?? ''])

    // Vertically merge Sr No, Loc No, Tower type across the pair of rows
    for (let c = 1; c <= 3; c++) locSheet.mergeCells(r1, c, r2, c)

    // Style + merge each stage's status/date cell across the pair, with color + dropdown
    STAGE_COLUMNS.forEach((col, idx) => {
      const statusCol = STAGE_COL_START + idx
      const dateCol    = DATE_COL_START + idx
      const value = loc[col.statusField] ?? ''
      locSheet.mergeCells(r1, statusCol, r2, statusCol)
      locSheet.mergeCells(r1, dateCol, r2, dateCol)

      const statusCell = locSheet.getCell(r1, statusCol)
      const opt = col.options.find(o => o.value === value)
      if (opt) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[opt.color] } }
        statusCell.font = { bold: true, color: { argb: FONT[opt.color] } }
      }
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' }
      statusCell.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${col.options.map(o => o.value).join(',')}"`] }

      const dateCell = locSheet.getCell(r1, dateCol)
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    for (let c = 1; c <= headers.length; c++) {
      locSheet.getCell(r1, c).border = allBorder
      locSheet.getCell(r2, c).border = allBorder
    }
    const spanCell = locSheet.getCell(r2, 4)
    spanCell.alignment = { horizontal: 'center' }
  })

  // ── Totals row: span sum, and per-stage completed count (each column's own rule) ──
  const spanTotal = locations.reduce((s, l) => s + (Number(l.span) || 0), 0)
  const totalsVals: (string | number)[] = ['', '', 'Total', spanTotal]
  for (const col of STAGE_COLUMNS) totalsVals.push(locations.filter(l => col.isCompleted(l[col.statusField])).length)
  for (let i = 0; i < STAGE_COLUMNS.length; i++) totalsVals.push('')
  const totalsRow = locSheet.addRow(totalsVals)
  totalsRow.eachCell({ includeEmpty: true }, c => {
    c.font = { bold: true }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border = { top: { style: 'medium', color: { argb: 'FF990000' } }, bottom: thin, left: thin, right: thin }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F3F3' } }
  })

  locSheet.getColumn(1).width = 8
  locSheet.getColumn(2).width = 10
  locSheet.getColumn(3).width = 14
  locSheet.getColumn(4).width = 10
  for (let i = 0; i < STAGE_COLUMNS.length; i++) locSheet.getColumn(STAGE_COL_START + i).width = 13
  for (let i = 0; i < STAGE_COLUMNS.length; i++) locSheet.getColumn(DATE_COL_START + i).width = 13
  locSheet.views = [{ state: 'frozen', ySplit: 1 }]

  // Towers marked "Don't include in total towers" are excluded from every
  // count/summary below (Progress Summary, Billing Summary, Tower Type Summary) —
  // they still appear in the Locations sheet and Tower Diagram.
  const counted = locations.filter(l => !l.excludeFromTotal)

  // ── Sheet 2: Progress Summary (mirrors WORKED / COMPLETED / BALANCE) ──
  // Stringing/OPGW rows are measured in total span (conductor length) completed,
  // not tower count — see stageQty().
  const sumSheet = workbook.addWorksheet('Progress Summary')
  const sumHeaderRow = sumSheet.addRow(['Stage', 'Total Towers', 'Completed', 'Balance', 'Completed %'])
  sumHeaderRow.eachCell(c => { c.font = { bold: true }; c.alignment = { horizontal: 'center' }; c.border = allBorder })
  for (const col of STAGE_COLUMNS) {
    const colTotal = stageQty(col, counted)
    const completed = stageQty(col, counted.filter(l => col.isCompleted(l[col.statusField])))
    const r = sumSheet.addRow([col.label, colTotal, completed, colTotal - completed, colTotal > 0 ? Math.round((completed / colTotal) * 100) + '%' : '0%'])
    r.eachCell(c => { c.border = allBorder; c.alignment = { horizontal: 'center' } })
  }
  sumSheet.columns.forEach(c => { c.width = 16 })

  // ── Sheet 2b: Billing Summary — WORKED / BILLED (RA rounds), like the source sheet ──
  const billedCols = STAGE_COLUMNS.filter(c => c.raField)
  const billSheet = workbook.addWorksheet('Billing Summary')
  const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9E2F3' } }
  const HEADER_FONT = { bold: true, color: { argb: 'FF990000' } }

  const billHeaderRow = billSheet.addRow(['DESCRIPTION', '', ...billedCols.map(c => c.label.toUpperCase())])
  billHeaderRow.eachCell(c => { c.font = HEADER_FONT; c.fill = HEADER_FILL; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = allBorder })
  billSheet.mergeCells(billHeaderRow.number, 1, billHeaderRow.number, 2)

  function billRow(label: string, values: (string | number)[], opts: { bold?: boolean; fill?: string } = {}) {
    const r = billSheet.addRow(['', label, ...values])
    r.eachCell({ includeEmpty: true }, c => {
      c.border = allBorder
      c.alignment = { horizontal: 'center', vertical: 'middle' }
      if (opts.bold) c.font = { bold: true, color: opts.fill ? { argb: 'FF990000' } : undefined }
      if (opts.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } }
    })
    return r
  }

  // ── WORKED block ── (Stringing/OPGW columns are span sums — see stageQty())
  const workedTotals   = billedCols.map(c => stageQty(c, counted))
  const workedCompleted = billedCols.map(c => stageQty(c, counted.filter(l => c.isCompleted(l[c.statusField]))))
  const workedStartRow = billSheet.rowCount + 1
  billRow('LOI QTY',   workedTotals)
  billRow('COMPLETED', workedCompleted)
  billRow('BALANCE',   workedTotals.map((t, i) => t - workedCompleted[i]), { bold: true })
  billSheet.mergeCells(workedStartRow, 1, workedStartRow + 2, 1)
  const workedLabel = billSheet.getCell(workedStartRow, 1)
  workedLabel.value = 'WORKED'
  workedLabel.font = HEADER_FONT
  workedLabel.fill = HEADER_FILL
  workedLabel.alignment = { horizontal: 'center', vertical: 'middle' }

  billSheet.addRow([]) // spacer

  // ── BILLED block (RA rounds) ──
  const billedStartRow = billSheet.rowCount + 1
  const raCounts: Record<string, number[]> = {}
  for (const opt of billingOptions) {
    raCounts[opt] = billedCols.map(c => stageQty(c, counted.filter(l => (l[c.raField!] ?? '') === opt)))
    billRow(opt, raCounts[opt])
  }
  const totalBilled = billedCols.map((_, i) => billingOptions.reduce((s, opt) => s + raCounts[opt][i], 0))
  billRow('TOTAL', totalBilled, { bold: true, fill: 'FFD9E2F3' })
  billSheet.mergeCells(billedStartRow, 1, billedStartRow + Math.max(billingOptions.length, 1) - 1, 1)
  const billedLabel = billSheet.getCell(billedStartRow, 1)
  billedLabel.value = 'BILLED'
  billedLabel.font = HEADER_FONT
  billedLabel.fill = HEADER_FILL
  billedLabel.alignment = { horizontal: 'center', vertical: 'middle' }

  billRow('BALANCE', billedCols.map((c, i) => workedCompleted[i] - totalBilled[i]))

  billSheet.getColumn(1).width = 4
  billSheet.getColumn(2).width = 14
  for (let i = 0; i < billedCols.length; i++) billSheet.getColumn(3 + i).width = 14

  // ── Sheet: Tower Diagram — Loc No / Erection / Foundation / Type, span connectors ──
  const diagSheet = workbook.addWorksheet('Tower Diagram')
  const erectionCol   = STAGE_COLUMNS.find(c => c.key === 'erection')!
  const foundationCol = STAGE_COLUMNS.find(c => c.key === 'foundation')!
  const rowLabels = ['Loc No.', 'Erection', 'Foundation', 'Type of tower']
  rowLabels.forEach((label, i) => {
    const cell = diagSheet.getCell(i + 1, 1)
    cell.value = label
    cell.font = { bold: true, size: 12 }
    cell.alignment = { horizontal: 'right', vertical: 'middle' }
  })
  diagSheet.getColumn(1).width = 16

  let col = 2
  locations.forEach((loc, i) => {
    if (i > 0) {
      // connector column: span value up top, a line drawn via a bottom border across rows 1-2
      diagSheet.getColumn(col).width = 8
      const spanCell = diagSheet.getCell(1, col)
      spanCell.value = loc.span ?? ''
      spanCell.font = { bold: true, size: 12 }
      spanCell.alignment = { horizontal: 'center', vertical: 'bottom' }
      diagSheet.getCell(2, col).border = { bottom: { style: 'medium', color: { argb: 'FF64748B' } } }
      diagSheet.getCell(3, col).border = { bottom: { style: 'medium', color: { argb: 'FF64748B' } } }
      col++
    }
    diagSheet.getColumn(col).width = 16

    // Every cell in the tower's column gets a border, even when blank, so an
    // empty stage still shows a visible box you can identify by position.
    const locCell = diagSheet.getCell(1, col)
    locCell.value = loc.locationNo
    locCell.font = { bold: true, size: 13 }
    locCell.alignment = { horizontal: 'center', vertical: 'middle' }
    locCell.border = allBorder

    ;[[2, erectionCol], [3, foundationCol]].forEach(([r, stageCol]: any) => {
      const value = loc[stageCol.statusField] ?? ''
      const cell = diagSheet.getCell(r, col)
      cell.value = value
      cell.font = { bold: true, size: 12 }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      const boxBorder = { style: 'medium' as const, color: { argb: 'FF1E293B' } }
      cell.border = { top: boxBorder, bottom: boxBorder, left: boxBorder, right: boxBorder }
      const opt = stageCol.options.find((o: any) => o.value === value)
      if (opt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[opt.color] } }
    })

    const typeCell = diagSheet.getCell(4, col)
    typeCell.value = loc.towerType
    typeCell.font = { bold: true, size: 11 }
    typeCell.alignment = { horizontal: 'center', vertical: 'middle' }
    typeCell.border = allBorder

    col++
  })
  diagSheet.getRow(1).height = 26
  diagSheet.getRow(2).height = 30
  diagSheet.getRow(3).height = 30
  diagSheet.getRow(4).height = 24

  // ── Sheet 3: Tower Type Summary (type x angle matrix, like the source sheet) ──
  const typeSheet = workbook.addWorksheet('Tower Type Summary')
  const parsed = counted.map(l => parseTowerType(l.towerType))
  const types  = [...new Set(parsed.map(p => p.type))].sort()
  const angles = [...new Set(parsed.map(p => p.angle))].sort((a, b) => Number(a) - Number(b))
  const typeHeaderRow = typeSheet.addRow(['Type', ...angles.map(a => `${a}°`), 'Total'])
  typeHeaderRow.eachCell(c => { c.font = { bold: true }; c.alignment = { horizontal: 'center' }; c.border = allBorder })
  const angleTotals: Record<string, number> = Object.fromEntries(angles.map(a => [a, 0]))
  let grandTotal = 0
  for (const type of types) {
    const counts = angles.map(a => parsed.filter(p => p.type === type && p.angle === a).length)
    counts.forEach((c, i) => { angleTotals[angles[i]] += c })
    const rowTotal = counts.reduce((s, c) => s + c, 0)
    grandTotal += rowTotal
    const r = typeSheet.addRow([type, ...counts, rowTotal])
    r.eachCell(c => { c.border = allBorder; c.alignment = { horizontal: 'center' } })
  }
  const totalRow = typeSheet.addRow(['Total', ...angles.map(a => angleTotals[a]), grandTotal])
  totalRow.eachCell(c => { c.border = allBorder; c.alignment = { horizontal: 'center' }; c.font = { bold: true } })
  typeSheet.columns.forEach(c => { c.width = 12 })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${siteName || 'Site'} - Tower Locations.xlsx`
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── Sub-components ────────────────────────────────────────────

function StageCell({
  col, loc, onChange, onChangeRa, loading, raLoading, rowSpan = 1, billingOptions, onAddBillingOption,
}: {
  col: typeof STAGE_COLUMNS[number]
  loc: any
  onChange: (stageKey: string, value: string) => void
  onChangeRa: (stageKey: string, value: string) => void
  loading: boolean
  raLoading: boolean
  rowSpan?: number
  billingOptions: string[]
  onAddBillingOption: (stageKey: string) => void
}) {
  const value = loc[col.statusField] ?? ''
  const date  = loc[col.dateField] ?? ''
  const ra    = col.raField ? (loc[col.raField] ?? '') : ''
  return (
    <td rowSpan={rowSpan} className="px-1 py-1 align-top text-center border-b border-slate-100">
      <select
        value={value}
        disabled={loading}
        onChange={(e) => onChange(col.key, e.target.value)}
        className={`w-full text-xs font-bold rounded border px-1 py-1 outline-none disabled:opacity-50 text-center ${optionColor(col, value)}`}
      >
        <option value="">—</option>
        {col.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <p className="text-[10px] text-slate-500 mt-0.5 text-center min-h-[14px]">{date || ''}</p>
      {col.raField && (
        <select
          value={ra}
          disabled={raLoading}
          onChange={(e) => {
            if (e.target.value === '__add__') { onAddBillingOption(col.key); return }
            onChangeRa(col.key, e.target.value)
          }}
          className="w-full text-[10px] font-semibold rounded border border-slate-200 bg-white text-slate-600 px-1 py-0.5 mt-0.5 outline-none disabled:opacity-50 text-center"
        >
          <option value="">Billing —</option>
          {billingOptions.map(o => <option key={o} value={o}>{o}</option>)}
          <option value="__add__">+ Add new...</option>
        </select>
      )}
    </td>
  )
}

function WorkLogBar({ logs }: { logs: any[] }) {
  const groups: Record<string, number> = {}
  for (const log of logs) {
    const name = log.workType?.name ?? 'Other'
    groups[name] = (groups[name] ?? 0) + (log.quantity ?? 0)
  }
  const entries = Object.entries(groups)
  if (entries.length === 0) return null
  const max = Math.max(...entries.map(([, v]) => v), 1)
  const COLORS = ['bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500']

  return (
    <div className="space-y-2">
      {entries.map(([name, total], i) => (
        <div key={name}>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-800">{name}</span>
            <span className="text-slate-600">{total.toFixed(1)}</span>
          </div>
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${COLORS[i % COLORS.length]}`}
              style={{ width: `${(total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Data view modal: same data as the Excel export, on-screen ─────────────
function LocationsDataModal({
  locations, siteName, onClose, billingOptions,
}: {
  locations: any[]
  siteName: string
  onClose: () => void
  billingOptions: string[]
}) {
  // Towers marked "Don't include in total towers" are excluded from every
  // count/summary below (Progress Summary, Billing Summary, Tower Type Summary) —
  // they still appear in the Locations table.
  const counted = locations.filter(l => !l.excludeFromTotal)
  const billedCols = STAGE_COLUMNS.filter(c => c.raField)

  // Progress Summary (mirrors "Progress Summary" sheet). Stringing/OPGW rows are
  // measured in total span (conductor length) completed, not tower count — see stageQty().
  const progressRows = STAGE_COLUMNS.map(col => {
    const colTotal = stageQty(col, counted)
    const completed = stageQty(col, counted.filter(l => col.isCompleted(l[col.statusField])))
    return {
      label: col.label,
      total: colTotal,
      completed,
      balance: colTotal - completed,
      pct: colTotal > 0 ? Math.round((completed / colTotal) * 100) : 0,
    }
  })

  // Billing Summary (mirrors "Billing Summary" sheet)
  const workedTotals = billedCols.map(c => stageQty(c, counted))
  const worked = billedCols.map(c => ({
    completed: stageQty(c, counted.filter(l => c.isCompleted(l[c.statusField]))),
  }))
  const raCounts: Record<string, number[]> = {}
  for (const opt of billingOptions) {
    raCounts[opt] = billedCols.map(c => stageQty(c, counted.filter(l => (l[c.raField!] ?? '') === opt)))
  }
  const totalBilled = billedCols.map((_, i) => billingOptions.reduce((s, opt) => s + raCounts[opt][i], 0))

  // Tower Type Summary (mirrors "Tower Type Summary" sheet)
  const parsed = counted.map(l => parseTowerType(l.towerType))
  const types  = [...new Set(parsed.map(p => p.type))].sort()
  const angles = [...new Set(parsed.map(p => p.angle))].sort((a, b) => Number(a) - Number(b))
  const angleTotals: Record<string, number> = Object.fromEntries(angles.map(a => [a, 0]))
  const typeRows = types.map(type => {
    const counts = angles.map(a => parsed.filter(p => p.type === type && p.angle === a).length)
    counts.forEach((c, i) => { angleTotals[angles[i]] += c })
    return { type, counts, rowTotal: counts.reduce((s, c) => s + c, 0) }
  })
  const grandTotal = typeRows.reduce((s, r) => s + r.rowTotal, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-[90vw] max-w-none max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-900">{siteName ? `${siteName} — ` : ''}Locations Data</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-6">

          {/* Locations (full detail — mirrors "Locations" sheet) */}
          <section>
            <h4 className="font-bold text-slate-800 text-sm mb-2">Locations</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">Sr No.</th>
                    <th className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">Loc No.</th>
                    <th className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">Tower type</th>
                    <th className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">Span</th>
                    {STAGE_COLUMNS.map(col => (
                      <th key={col.key} className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">{col.label}</th>
                    ))}
                    {STAGE_COLUMNS.map(col => (
                      <th key={`${col.key}-d`} className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">{col.label} Date</th>
                    ))}
                    <th className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {locations.map((loc, i) => (
                    <Fragment key={loc.id}>
                      {/* Main row — tower's own data, plus Tower Remarks */}
                      <tr>
                        <td className="px-2 py-2 text-center text-slate-700">{i + 1}</td>
                        <td className="px-2 py-2 text-center font-bold text-slate-900 whitespace-nowrap">{loc.locationNo}</td>
                        <td className="px-2 py-2 text-center text-slate-700 whitespace-nowrap">{loc.towerType}</td>
                        <td className="px-2 py-2 text-center text-slate-300">—</td>
                        {STAGE_COLUMNS.map(col => {
                          const value = loc[col.statusField] ?? ''
                          return (
                            <td key={col.key} className="px-1 py-1 text-center">
                              <span className={`inline-block w-full font-bold rounded border px-1.5 py-1 ${optionColor(col, value)}`}>
                                {value || '—'}
                              </span>
                            </td>
                          )
                        })}
                        {STAGE_COLUMNS.map(col => (
                          <td key={`${col.key}-d`} className="px-2 py-2 text-center text-slate-500 whitespace-nowrap">
                            {loc[col.dateField] || '—'}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center text-slate-700">{loc.notes || '—'}</td>
                      </tr>
                      {/* Extra row — otherwise empty, carrying only the Span value and
                          Span Remarks (distance from the previous tower) */}
                      <tr className="bg-slate-50/50">
                        <td />
                        <td />
                        <td />
                        <td className="px-2 py-2 text-center text-slate-700 font-semibold">{i === 0 ? '—' : (loc.span || '—')}</td>
                        {STAGE_COLUMNS.map(col => <td key={col.key} />)}
                        {STAGE_COLUMNS.map(col => <td key={`${col.key}-d`} />)}
                        <td className="px-2 py-2 text-center text-slate-500">{i === 0 ? '—' : (loc.spanRemarks || '—')}</td>
                      </tr>
                    </Fragment>
                  ))}
                  {/* Totals row: span sum + per-stage completed count */}
                  <tr className="bg-slate-50 font-bold text-slate-800">
                    <td className="px-2 py-2 text-center" colSpan={3}>Total</td>
                    <td className="px-2 py-2 text-center">{locations.reduce((s, l) => s + (Number(l.span) || 0), 0)}</td>
                    {STAGE_COLUMNS.map(col => (
                      <td key={col.key} className="px-2 py-2 text-center">
                        {locations.filter(l => col.isCompleted(l[col.statusField])).length}
                      </td>
                    ))}
                    {STAGE_COLUMNS.map(col => <td key={`${col.key}-d`} className="px-2 py-2" />)}
                    <td className="px-2 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Progress Summary */}
          <section>
            <h4 className="font-bold text-slate-800 text-sm mb-2">Progress Summary</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="px-3 py-2 text-left font-bold">Stage</th>
                    <th className="px-3 py-2 text-center font-bold">Total Towers</th>
                    <th className="px-3 py-2 text-center font-bold">Completed</th>
                    <th className="px-3 py-2 text-center font-bold">Balance</th>
                    <th className="px-3 py-2 text-center font-bold">Completed %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {progressRows.map(r => (
                    <tr key={r.label}>
                      <td className="px-3 py-2 font-semibold text-slate-800">{r.label}</td>
                      <td className="px-3 py-2 text-center text-slate-700">{r.total}</td>
                      <td className="px-3 py-2 text-center text-emerald-700 font-semibold">{r.completed}</td>
                      <td className="px-3 py-2 text-center text-slate-700">{r.balance}</td>
                      <td className="px-3 py-2 text-center text-slate-700">{r.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Billing Summary */}
          {billedCols.length > 0 && (
            <section>
              <h4 className="font-bold text-slate-800 text-sm mb-2">Billing Summary</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="px-3 py-2 text-left font-bold" colSpan={2}>Description</th>
                      {billedCols.map(c => (
                        <th key={c.key} className="px-3 py-2 text-center font-bold whitespace-nowrap">{c.label.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* WORKED block */}
                    <tr className="bg-blue-50/40">
                      <td className="px-3 py-2 font-bold text-slate-700" rowSpan={3}>WORKED</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">LOI QTY</td>
                      {workedTotals.map((t, i) => <td key={i} className="px-3 py-2 text-center text-slate-700">{t}</td>)}
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-semibold text-slate-700">COMPLETED</td>
                      {worked.map((w, i) => <td key={i} className="px-3 py-2 text-center text-emerald-700 font-semibold">{w.completed}</td>)}
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-semibold text-slate-700">BALANCE</td>
                      {worked.map((w, i) => <td key={i} className="px-3 py-2 text-center font-bold text-slate-800">{workedTotals[i] - w.completed}</td>)}
                    </tr>
                    {/* BILLED block */}
                    {billingOptions.length === 0 ? (
                      <tr className="border-t-2 border-slate-200">
                        <td className="px-3 py-2 font-bold text-slate-700">BILLED</td>
                        <td className="px-3 py-2 text-slate-400 italic text-sm" colSpan={billedCols.length + 1}>No billing options yet</td>
                      </tr>
                    ) : billingOptions.map((opt, ri) => (
                      <tr key={opt} className={ri === 0 ? 'border-t-2 border-slate-200' : ''}>
                        {ri === 0 && <td className="px-3 py-2 font-bold text-slate-700" rowSpan={billingOptions.length}>BILLED</td>}
                        <td className="px-3 py-2 font-semibold text-slate-700">{opt}</td>
                        {raCounts[opt].map((v, i) => <td key={i} className="px-3 py-2 text-center text-slate-700">{v}</td>)}
                      </tr>
                    ))}
                    <tr className="bg-blue-50/40">
                      <td className="px-3 py-2 font-bold text-slate-700"></td>
                      <td className="px-3 py-2 font-bold text-slate-800">TOTAL</td>
                      {totalBilled.map((v, i) => <td key={i} className="px-3 py-2 text-center font-bold text-slate-800">{v}</td>)}
                    </tr>
                    <tr>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 font-semibold text-slate-700">BALANCE</td>
                      {billedCols.map((c, i) => (
                        <td key={c.key} className="px-3 py-2 text-center text-slate-700">{worked[i].completed - totalBilled[i]}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Tower Type Summary */}
          <section>
            <h4 className="font-bold text-slate-800 text-sm mb-2">Tower Type Summary</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="px-3 py-2 text-left font-bold">Type</th>
                    {angles.map(a => <th key={a} className="px-3 py-2 text-center font-bold">{a}°</th>)}
                    <th className="px-3 py-2 text-center font-bold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {typeRows.map(r => (
                    <tr key={r.type}>
                      <td className="px-3 py-2 font-semibold text-slate-800">{r.type}</td>
                      {r.counts.map((c, i) => <td key={i} className="px-3 py-2 text-center text-slate-700">{c}</td>)}
                      <td className="px-3 py-2 text-center font-semibold text-slate-800">{r.rowTotal}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td className="px-3 py-2 text-slate-800">Total</td>
                    {angles.map(a => <td key={a} className="px-3 py-2 text-center text-slate-800">{angleTotals[a]}</td>)}
                    <td className="px-3 py-2 text-center text-slate-800">{grandTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

// ── Tower Diagram tab: towers laid out in sequence, wrapping onto new lines
//    (instead of one long horizontally-scrolling row) when they don't fit ───
function TowerDiagramTab({ locations }: { locations: any[] }) {
  const erectionCol   = STAGE_COLUMNS.find(c => c.key === 'erection')
  const foundationCol = STAGE_COLUMNS.find(c => c.key === 'foundation')

  if (!erectionCol || !foundationCol) return null

  if (locations.length === 0) {
    return (
      <div className="card p-10 text-center text-slate-500 text-sm">
        No locations added yet — add tower locations to see the diagram
      </div>
    )
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-y-5">
        {locations.map((loc, i) => (
          <Fragment key={loc.id}>
            {i > 0 && (
              <div className="flex flex-col items-center justify-center px-2 min-w-[44px]">
                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">{loc.span || '—'}</span>
                <div className="w-8 h-0.5 bg-slate-300 mt-1" />
              </div>
            )}
            <div className="flex flex-col items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <div className="text-sm font-bold text-slate-900 whitespace-nowrap">{loc.locationNo}</div>
              <div className={`text-xs font-bold border-2 border-slate-800 rounded px-2 py-1.5 min-w-[64px] text-center whitespace-nowrap ${optionColor(erectionCol, loc[erectionCol.statusField])}`}>
                {loc[erectionCol.statusField] || '—'}
              </div>
              <div className={`text-xs font-bold border-2 border-slate-800 rounded px-2 py-1.5 min-w-[64px] text-center whitespace-nowrap ${optionColor(foundationCol, loc[foundationCol.statusField])}`}>
                {loc[foundationCol.statusField] || '—'}
              </div>
              <div className="text-xs font-semibold text-slate-700 whitespace-nowrap">{loc.towerType}</div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// ── Manage custom billing (RA round) options: add, rename, delete ───────────
function BillingOptionsModal({
  options, onClose, onAdd, onRename, onDelete, onApply,
}: {
  options: { id: string; name: string }[]
  onClose: () => void
  onAdd: (name: string) => Promise<{ id: string; name: string } | null>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string, name: string) => Promise<void>
  onApply?: (name: string) => void
}) {
  const [name, setName]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [busyId, setBusyId]     = useState<string | null>(null)

  async function handleSave(keepOpen: boolean) {
    if (!name.trim()) { setError('Enter a name'); return }
    setSaving(true); setError('')
    const result = await onAdd(name.trim())
    setSaving(false)
    if (!result) { setError('Could not add that option'); return }
    onApply?.(result.name)
    setName('')
    if (!keepOpen) onClose()
  }

  async function handleRenameSave(id: string) {
    if (!editValue.trim()) { setEditingId(null); return }
    setBusyId(id)
    await onRename(id, editValue.trim())
    setBusyId(null); setEditingId(null)
  }

  async function handleDelete(id: string, optName: string) {
    if (!confirm(`Delete billing option "${optName}"? This clears it from any location currently using it.`)) return
    setBusyId(id)
    await onDelete(id, optName)
    setBusyId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="font-bold text-slate-900">Manage Billing Options</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Billing Options</p>
            {options.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No billing options yet</p>
            ) : (
              <div className="space-y-1.5">
                {options.map(o => editingId === o.id ? (
                  <div key={o.id} className="flex items-center gap-1.5">
                    <input autoFocus className="input flex-1 text-sm py-1.5"
                      value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSave(o.id); if (e.key === 'Escape') setEditingId(null) }} />
                    <button type="button" onClick={() => handleRenameSave(o.id)} disabled={busyId === o.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">✓</button>
                    <button type="button" onClick={() => setEditingId(null)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-500">✕</button>
                  </div>
                ) : (
                  <div key={o.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-800">{o.name}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" title="Rename" disabled={busyId === o.id}
                        onClick={() => { setEditingId(o.id); setEditValue(o.name) }}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button type="button" title="Delete" disabled={busyId === o.id}
                        onClick={() => handleDelete(o.id, o.name)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Add New</label>
            <input className="input" placeholder='e.g. "5th RA"' value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(false) }} />
            {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Close</button>
          <button type="button" onClick={() => handleSave(true)} disabled={saving}
            className="btn-secondary flex-1 disabled:opacity-60">
            {saving ? 'Saving...' : 'Save & Add Another'}
          </button>
          <button type="button" onClick={() => handleSave(false)} disabled={saving}
            className="btn flex-1 disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export function WorkLogsView({
  siteId,
  siteName,
  logs,
  workTypes,
  initialLocations,
  initialBillingOptions,
}: {
  siteId: string
  siteName?: string
  logs: any[]
  workTypes: any[]
  initialLocations: any[]
  initialBillingOptions?: any[]
}) {
  const [locations, setLocations]       = useState<any[]>(initialLocations)
  const [activeTab, setActiveTab]       = useState<'locations' | 'diagram' | 'logs'>('locations')
  const [showAddLoc, setShowAddLoc]     = useState(false)
  const [editingLoc, setEditingLoc]     = useState<any | null>(null)
  const [showAddLog, setShowAddLog]     = useState(false)
  const [showDataModal, setShowDataModal] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [cellLoading, setCellLoading]   = useState<string | null>(null)
  const [error, setError]               = useState('')
  const [ok, setOk]                     = useState('')
  const [customBillingOpts, setCustomBillingOpts] = useState<{ id: string; name: string }[]>(initialBillingOptions ?? [])
  const [billingModalOpen, setBillingModalOpen] = useState(false)
  const [billingPending, setBillingPending]     = useState<{ locId: string; stageKey: string } | null>(null)

  // Fully dynamic — every billing/RA-round label comes from what the client has
  // saved via the Billing Options modal. Nothing is hardcoded here.
  const billingOptions = customBillingOpts.map(o => o.name)

  function flash(msg: string) { setOk(msg); setTimeout(() => setOk(''), 3000) }

  // ── Manage custom billing options (add / rename / delete) ───────────────
  function openBillingModal(locId?: string, stageKey?: string) {
    setBillingPending(locId && stageKey ? { locId, stageKey } : null)
    setBillingModalOpen(true)
  }

  async function handleCreateBillingOption(name: string) {
    const result: any = await createCustomBillingOption(siteId, name)
    if (result?.error) { setError(result.error); return null }
    setCustomBillingOpts(prev => prev.some(o => o.name.toLowerCase() === result.name.toLowerCase())
      ? prev
      : [...prev, { id: result.id, name: result.name }])
    return { id: result.id, name: result.name }
  }

  async function handleRenameBillingOption(id: string, newName: string) {
    const result: any = await renameCustomBillingOption(id, newName, siteId)
    if (result?.error) { setError(result.error); return }
    setCustomBillingOpts(prev => prev.map(o => o.id === id ? { ...o, name: result.name } : o))
    const fresh = await getSiteLocations(siteId)
    setLocations(fresh)
  }

  async function handleDeleteBillingOption(id: string) {
    const result: any = await deleteCustomBillingOption(id, siteId)
    if (result?.error) { setError(result.error); return }
    setCustomBillingOpts(prev => prev.filter(o => o.id !== id))
    const fresh = await getSiteLocations(siteId)
    setLocations(fresh)
  }

  function handleApplyBillingOption(name: string) {
    if (billingPending) handleRaChange(billingPending.locId, billingPending.stageKey, name)
  }

  // ── Add / Edit Location ─────────────────────────────────────
  async function handleSaveLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const form = e.currentTarget
    const submitter = (e.nativeEvent as any).submitter as HTMLButtonElement | undefined
    const keepOpen = submitter?.value === 'addAnother'
    const fd = new FormData(form)
    const stages: Record<string, string> = {}
    for (const col of STAGE_COLUMNS) stages[col.key] = (fd.get(col.key) as string) || ''
    const ra: Record<string, string> = {}
    for (const col of STAGE_COLUMNS) if (col.raField) ra[col.key] = (fd.get(`ra_${col.key}`) as string) || ''

    const data = {
      siteId,
      locationNo:  fd.get('locationNo') as string,
      towerType:   fd.get('towerType')  as string,
      span:        (fd.get('span') as string) || '',
      spanRemarks: fd.get('spanRemarks') as string,
      notes:       fd.get('notes') as string,
      excludeFromTotal: fd.get('excludeFromTotal') === 'on',
      stages,
      ra,
    }

    let result: any
    if (editingLoc) {
      result = await updateSiteLocation(editingLoc.id, data)
    } else {
      result = await createSiteLocation(data)
    }
    setLoading(false)
    if (result?.error) { setError(result.error); return }

    const fresh = await getSiteLocations(siteId)
    setLocations(fresh)

    if (keepOpen && !editingLoc) {
      flash('Location added!')
      form.reset()
      return
    }

    flash(editingLoc ? 'Location updated!' : 'Location added!')
    setShowAddLoc(false); setEditingLoc(null)
  }

  // ── Stage cell change (one-tap, per column) ─────────────────
  async function handleStageChange(locId: string, stageKey: string, value: string) {
    setCellLoading(`${locId}:${stageKey}`)
    const result: any = await updateLocationStageField(locId, stageKey, value, siteId)
    if (!result?.error) {
      const col = STAGE_COLUMNS.find(c => c.key === stageKey)!
      setLocations(prev => prev.map(l => l.id === locId
        ? { ...l, [col.statusField]: result[col.statusField], [col.dateField]: result[col.dateField] }
        : l))
    }
    setCellLoading(null)
  }

  // ── RA billing change (one-tap, per column) ──────────────────
  async function handleRaChange(locId: string, stageKey: string, value: string) {
    setCellLoading(`${locId}:${stageKey}:ra`)
    const result: any = await updateLocationRaField(locId, stageKey, value, siteId)
    if (!result?.error) {
      const col = STAGE_COLUMNS.find(c => c.key === stageKey)!
      setLocations(prev => prev.map(l => l.id === locId ? { ...l, [col.raField!]: result[col.raField!] } : l))
    }
    setCellLoading(null)
  }

  // ── Delete location ─────────────────────────────────────────
  async function handleDeleteLoc(id: string, name: string) {
    if (!confirm(`Delete location "${name}"?`)) return
    await deleteSiteLocation(id, siteId)
    setLocations(prev => prev.filter(l => l.id !== id))
    flash('Location deleted')
  }

  // ── Add work log ────────────────────────────────────────────
  async function handleAddLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    const wtId = fd.get('workTypeId') as string
    const wt   = workTypes.find(w => w.id === wtId)
    const result = await createWorkLog({
      siteId,
      workTypeId:  wtId,
      quantity:    Number(fd.get('quantity')),
      unit:        wt?.unit ?? '',
      date:        fd.get('date') as string,
      description: fd.get('description') as string,
    })
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    flash('Work log added!'); setShowAddLog(false)
    window.location.reload()
  }

  // Span is the distance from the previous tower — only hide the field when adding
  // the very first tower ever (no towers exist yet). Editing always shows it, so an
  // existing span value never gets silently wiped by a form that omits the field.
  const isFirstEntry = !editingLoc && locations.length === 0

  return (
    <div className="space-y-5">

      {ok    && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">✓ {ok}</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">{error}</div>}

      {/* Data view modal */}
      {showDataModal && (
        <LocationsDataModal
          locations={locations}
          siteName={siteName || ''}
          onClose={() => setShowDataModal(false)}
          billingOptions={billingOptions}
        />
      )}

      {/* Billing options modal */}
      {billingModalOpen && (
        <BillingOptionsModal
          options={customBillingOpts}
          onClose={() => { setBillingModalOpen(false); setBillingPending(null) }}
          onAdd={handleCreateBillingOption}
          onRename={handleRenameBillingOption}
          onDelete={handleDeleteBillingOption}
          onApply={handleApplyBillingOption}
        />
      )}

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-slate-200">
        {([
          ['locations', `Locations (${locations.length})`],
          ['diagram',   'Tower Diagram'],
          ['logs',      `Work Logs (${logs.length})`],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === t ? 'border-orange-500 text-orange-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── LOCATIONS TAB ── */}
      {activeTab === 'locations' && (
        <div className="space-y-4">

          <div className="flex justify-end gap-2">
            {locations.length > 0 && (
              <>
                <button onClick={() => setShowDataModal(true)} className="btn-secondary text-sm">
                  👁 View Data
                </button>
                <button onClick={() => exportLocationsToExcel(locations, siteName || '', billingOptions)} className="btn-secondary text-sm">
                  ↓ Download Excel
                </button>
              </>
            )}
            <button onClick={() => openBillingModal()} className="btn-secondary text-sm">
              ⚙ Billing Options
            </button>
            <button onClick={() => { setShowAddLoc(true); setEditingLoc(null) }} className="btn text-sm">
              + Add Location
            </button>
          </div>

          {/* Add / Edit form */}
          {(showAddLoc || editingLoc) && (
            <form onSubmit={handleSaveLocation} className="card p-5 border-2 border-orange-200 space-y-4">
              <h3 className="font-bold text-slate-900">
                {editingLoc ? `Edit — ${editingLoc.locationNo}` : 'Add New Location'}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Location No. *</label>
                  <input name="locationNo" className="input" required
                    defaultValue={editingLoc?.locationNo ?? ''}
                    placeholder="e.g. T-01, L-05, Tower 12" />
                </div>
                <div>
                  <label className="label">Tower Type *</label>
                  <input name="towerType" className="input" required autoComplete="off"
                    defaultValue={editingLoc?.towerType ?? ''}
                    placeholder="Enter tower type" />
                </div>
              </div>

              {!isFirstEntry && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Span</label>
                    <input name="span" className="input"
                      defaultValue={editingLoc?.span ?? ''}
                      placeholder="Distance from the previous tower, e.g. 250" />
                    <p className="text-slate-500 text-xs mt-1">Distance between this tower and the previous one in the sequence</p>
                  </div>
                  <div>
                    <label className="label">Span Remarks</label>
                    <input name="spanRemarks" className="input"
                      defaultValue={editingLoc?.spanRemarks ?? ''}
                      placeholder="Any remarks about this span..." />
                  </div>
                </div>
              )}
              {isFirstEntry && (
                <p className="text-slate-500 text-xs">This is the first tower in the sequence — no span to enter.</p>
              )}

              <div>
                <label className="label">Tower Remarks</label>
                <input name="notes" className="input"
                  defaultValue={editingLoc?.notes ?? ''}
                  placeholder="Any additional remarks..." />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="excludeFromTotal" className="w-4 h-4 rounded border-slate-300"
                  defaultChecked={editingLoc?.excludeFromTotal ?? false} />
                Don't include in total towers
              </label>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAddLoc(false); setEditingLoc(null) }}
                  className="btn-secondary flex-1">Cancel</button>
                {!editingLoc && (
                  <button type="submit" name="intent" value="addAnother" disabled={loading}
                    className="btn-secondary flex-1 disabled:opacity-60">
                    {loading ? 'Saving...' : 'Save & Add Another'}
                  </button>
                )}
                <button type="submit" name="intent" value="close" disabled={loading} className="btn flex-1 disabled:opacity-60">
                  {loading ? 'Saving...' : editingLoc ? 'Update Location' : 'Add Location'}
                </button>
              </div>
            </form>
          )}

          {/* Locations table */}
          {locations.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-slate-700 font-bold mb-1">No locations added yet</p>
              <p className="text-slate-500 text-sm mb-4">
                Add tower locations in sequence — span, stage status and completion dates are tracked per tower
              </p>
              <button onClick={() => setShowAddLoc(true)} className="btn">Add First Location</button>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">Location</th>
                    <th className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">Type</th>
                    <th className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">Span</th>
                    {STAGE_COLUMNS.map(col => (
                      <th key={col.key} className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">{col.label}</th>
                    ))}
                    <th className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">Remarks</th>
                    <th className="px-2 py-2 text-center font-bold border-b border-slate-200 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {locations.map((loc, i) => (
                    <Fragment key={loc.id}>
                      {/* Main row — tower's own data, plus Tower Remarks */}
                      <tr>
                        <td className="px-2 py-2 text-center align-top font-bold text-slate-900 whitespace-nowrap">{loc.locationNo}</td>
                        <td className="px-2 py-2 text-center align-top text-slate-700 whitespace-nowrap">{loc.towerType}</td>
                        <td className="px-2 py-2 text-center align-top text-slate-300">—</td>
                        {STAGE_COLUMNS.map(col => (
                          <StageCell key={col.key} col={col} loc={loc}
                            loading={cellLoading === `${loc.id}:${col.key}`}
                            raLoading={cellLoading === `${loc.id}:${col.key}:ra`}
                            billingOptions={billingOptions}
                            onAddBillingOption={(stageKey) => openBillingModal(loc.id, stageKey)}
                            onChange={(stageKey, value) => handleStageChange(loc.id, stageKey, value)}
                            onChangeRa={(stageKey, value) => handleRaChange(loc.id, stageKey, value)} />
                        ))}
                        <td className="px-2 py-2 text-center align-top text-slate-700">{loc.notes || '—'}</td>
                        <td className="px-2 py-2 text-center align-top">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => { setEditingLoc(loc); setShowAddLoc(false) }}
                              className="text-slate-400 hover:text-slate-700 transition-colors p-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDeleteLoc(loc.id, loc.locationNo)}
                              className="text-slate-400 hover:text-red-600 transition-colors p-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Extra row — otherwise empty, carrying only the Span value and
                          Span Remarks (distance from the previous tower) */}
                      <tr className="bg-slate-50/50">
                        <td />
                        <td />
                        <td className="px-2 py-2 text-center text-slate-700 font-semibold">{i === 0 ? '—' : (loc.span || '—')}</td>
                        {STAGE_COLUMNS.map(col => <td key={col.key} />)}
                        <td className="px-2 py-2 text-center text-slate-500">{i === 0 ? '—' : (loc.spanRemarks || '—')}</td>
                        <td />
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TOWER DIAGRAM TAB ── */}
      {activeTab === 'diagram' && <TowerDiagramTab locations={locations} />}

      {/* ── WORK LOGS TAB ── */}
      {activeTab === 'logs' && (
        <div className="space-y-4">

          <div className="flex items-center justify-between">
            <p className="text-slate-600 text-sm">{logs.length} entries recorded</p>
            <button onClick={() => setShowAddLog(!showAddLog)} className="btn text-sm">+ Add Log</button>
          </div>

          {showAddLog && (
            <form onSubmit={handleAddLog} className="card p-5 border-2 border-orange-200 space-y-4">
              <h3 className="font-bold text-slate-900">Add Work Log</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Work Type *</label>
                  <select name="workTypeId" className="input" required>
                    <option value="">Select work type...</option>
                    {workTypes.map((wt: any) => (
                      <option key={wt.id} value={wt.id}>{wt.name} ({wt.unit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Quantity *</label>
                  <input name="quantity" type="number" className="input" required min="0.01" step="0.01" placeholder="e.g. 45" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date *</label>
                  <input name="date" type="date" className="input" required defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <input name="description" className="input" placeholder="Brief note..." />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddLog(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn flex-1 disabled:opacity-60">{loading ? 'Saving...' : 'Add Log'}</button>
              </div>
            </form>
          )}

          {/* Chart */}
          {logs.length > 0 && (
            <div className="card p-4 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">Work Progress by Type</h3>
              <WorkLogBar logs={logs} />
            </div>
          )}

          {/* Logs list */}
          <div className="card overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-500 text-sm mb-3">No work logs yet</p>
                <button onClick={() => setShowAddLog(true)} className="btn text-sm">Add First Log</button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.map((log: any, i: number) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-slate-900 text-sm font-bold">{log.workType?.name ?? 'Work'}</p>
                      <p className="text-slate-500 text-xs">
                        {log.description ?? ''}
                        {log.supervisor?.name ? ` · ${log.supervisor.name}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-orange-700 font-bold text-sm">
                        {(log.quantity ?? 0).toFixed(1)} {log.workType?.unit ?? log.unit}
                      </p>
                      <p className="text-slate-500 text-xs">{log.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
