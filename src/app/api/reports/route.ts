// @ts-nocheck
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { db, sites, workLogs, workTypes, materialLogs, materials, attendance, labour, accounting, lpos, users } from '@/lib/db'
import { eq, and, gte, lte } from 'drizzle-orm'

function toCSV(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map(c => `"${c.label}"`).join(',')
  const lines = rows.map(row =>
    columns.map(c => {
      const val = row[c.key]
      if (val === null || val === undefined) return '""'
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  )
  return [header, ...lines].join('\n')
}

function buildPDFHTML(title: string, siteName: string, sections: { heading: string; table: { columns: string[]; rows: string[][] } }[]): string {
  const tableHTML = sections.map(({ heading, table }) => {
    const thead = table.columns.map(c => `<th>${c}</th>`).join('')
    const tbody = table.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')
    return `<h2>${heading}</h2><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`
  }).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
  h1 { font-size: 18px; margin-bottom: 4px; color: #ea580c; }
  .meta { color: #666; font-size: 10px; margin-bottom: 20px; }
  h2 { font-size: 13px; margin: 20px 0 8px; color: #333; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f97316; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; font-size: 10px; }
  tr:nth-child(even) td { background: #fafafa; }
  .footer { margin-top: 30px; font-size: 9px; color: #999; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  @media print { body { padding: 0; } @page { margin: 15mm; size: A4; } }
</style>
</head>
<body>
<h1>BuildTrack Pro — ${title}</h1>
<p class="meta">Site: ${siteName} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</p>
${tableHTML}
<div class="footer">BuildTrack Pro &copy; ${new Date().getFullYear()} — Confidential Construction Report</div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const siteId     = searchParams.get('siteId')
  const reportType = searchParams.get('type') || 'site'
  const format     = searchParams.get('format') || 'csv'
  const from       = searchParams.get('from')
  const to         = searchParams.get('to')

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 })

  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1)
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  const dateConditions = (dateCol: Parameters<typeof gte>[0]) => {
    const conds = [eq(materialLogs.siteId, siteId)]
    if (from) conds.push(gte(dateCol, from))
    if (to)   conds.push(lte(dateCol, to))
    return conds
  }

  // ── MATERIAL REPORT ──────────────────────────────────────────
  if (reportType === 'material') {
    const conds = [eq(materialLogs.siteId, siteId)]
    if (from) conds.push(gte(materialLogs.date, from))
    if (to)   conds.push(lte(materialLogs.date, to))

    const logs = await db
      .select({ log: materialLogs, material: materials })
      .from(materialLogs)
      .leftJoin(materials, eq(materialLogs.materialId, materials.id))
      .where(and(...conds))
      .orderBy(materialLogs.date)

    if (format === 'csv') {
      const csv = toCSV(
        logs.map(({ log, material }) => ({
          date:      log.date,
          material:  material?.name ?? '',
          unit:      material?.unit ?? '',
          type:      log.type,
          quantity:  log.quantity.toString(),
          unitPrice: log.unitPrice?.toString() ?? '',
          total:     log.unitPrice ? (log.quantity * log.unitPrice).toFixed(2) : '',
          notes:     log.notes ?? '',
        })),
        [
          { key: 'date', label: 'Date' }, { key: 'material', label: 'Material' },
          { key: 'unit', label: 'Unit' }, { key: 'type', label: 'Type' },
          { key: 'quantity', label: 'Quantity' }, { key: 'unitPrice', label: 'Unit Price (AED)' },
          { key: 'total', label: 'Total Cost (AED)' }, { key: 'notes', label: 'Notes' },
        ]
      )
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="material-${siteId}.csv"` } })
    }

    const html = buildPDFHTML('Material Report', site.name, [{
      heading: 'Material Logs',
      table: {
        columns: ['Date', 'Material', 'Unit', 'Type', 'Qty', 'Unit Price', 'Total', 'Notes'],
        rows: logs.map(({ log, material }) => [
          log.date, material?.name ?? '', material?.unit ?? '', log.type,
          log.quantity.toString(),
          log.unitPrice ? `AED ${log.unitPrice.toFixed(2)}` : '-',
          log.unitPrice ? `AED ${(log.quantity * log.unitPrice).toFixed(2)}` : '-',
          log.notes ?? '-',
        ]),
      },
    }])
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
  }

  // ── LABOUR REPORT ────────────────────────────────────────────
  if (reportType === 'labour') {
    const conds = [eq(attendance.siteId, siteId)]
    if (from) conds.push(gte(attendance.date, from))
    if (to)   conds.push(lte(attendance.date, to))

    const rows = await db
      .select({ att: attendance, worker: labour })
      .from(attendance)
      .leftJoin(labour, eq(attendance.labourId, labour.id))
      .where(and(...conds))
      .orderBy(attendance.date)

    if (format === 'csv') {
      const csv = toCSV(
        rows.map(({ att, worker }) => ({
          date:      att.date,
          name:      worker?.name ?? '',
          trade:     worker?.trade ?? '',
          status:    att.status,
          halfDay:   att.halfDay ? 'Yes' : 'No',
          overtime:  att.overtime?.toString() ?? '0',
          dailyWage: worker?.dailyWage.toString() ?? '0',
          earned:    att.status === 'PRESENT' ? (att.halfDay ? (worker?.dailyWage ?? 0) / 2 : (worker?.dailyWage ?? 0)).toFixed(2) : '0.00',
        })),
        [
          { key: 'date', label: 'Date' }, { key: 'name', label: 'Worker' },
          { key: 'trade', label: 'Trade' }, { key: 'status', label: 'Status' },
          { key: 'halfDay', label: 'Half Day' }, { key: 'overtime', label: 'OT Hrs' },
          { key: 'dailyWage', label: 'Daily Rate (AED)' }, { key: 'earned', label: 'Earned (AED)' },
        ]
      )
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="labour-${siteId}.csv"` } })
    }

    const html = buildPDFHTML('Labour Report', site.name, [{
      heading: 'Attendance Records',
      table: {
        columns: ['Date', 'Worker', 'Trade', 'Status', 'Half Day', 'OT Hrs', 'Daily Rate', 'Earned'],
        rows: rows.map(({ att, worker }) => [
          att.date, worker?.name ?? '', worker?.trade ?? '', att.status,
          att.halfDay ? 'Yes' : 'No', att.overtime?.toString() ?? '0',
          `AED ${(worker?.dailyWage ?? 0).toFixed(2)}`,
          att.status === 'PRESENT' ? `AED ${(att.halfDay ? (worker?.dailyWage ?? 0) / 2 : (worker?.dailyWage ?? 0)).toFixed(2)}` : 'AED 0.00',
        ]),
      },
    }])
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
  }

  // ── FINANCIAL REPORT ─────────────────────────────────────────
  if (reportType === 'financial') {
    const conds = [eq(accounting.siteId, siteId)]
    if (from) conds.push(gte(accounting.date, from))
    if (to)   conds.push(lte(accounting.date, to))

    const entries = await db.select().from(accounting).where(and(...conds)).orderBy(accounting.date)
    const lpEntries = await db.select().from(lpos).where(eq(lpos.siteId, siteId))

    const totalIncome  = entries.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0)
    const totalExpense = entries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0)

    if (format === 'csv') {
      const csv = toCSV(
        entries.map(e => ({
          date: e.date, type: e.type, category: e.category,
          description: e.description,
          amount: e.amount.toString(),
          paymentMode: e.paymentMode, reference: e.reference ?? '',
        })),
        [
          { key: 'date', label: 'Date' }, { key: 'type', label: 'Type' },
          { key: 'category', label: 'Category' }, { key: 'description', label: 'Description' },
          { key: 'amount', label: 'Amount (AED)' }, { key: 'paymentMode', label: 'Mode' },
          { key: 'reference', label: 'Reference' },
        ]
      )
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="financial-${siteId}.csv"` } })
    }

    const html = buildPDFHTML('Financial Report', site.name, [
      {
        heading: `Summary — Income: AED ${totalIncome.toLocaleString()} | Expenses: AED ${totalExpense.toLocaleString()} | Net: AED ${(totalIncome - totalExpense).toLocaleString()}`,
        table: {
          columns: ['Date', 'Type', 'Category', 'Description', 'Amount (AED)', 'Mode', 'Reference'],
          rows: entries.map(e => [
            e.date, e.type, e.category, e.description,
            e.amount.toLocaleString('en', { minimumFractionDigits: 2 }),
            e.paymentMode, e.reference ?? '-',
          ]),
        },
      },
      {
        heading: 'LPOs (Purchase Orders)',
        table: {
          columns: ['LPO#', 'Vendor', 'Description', 'Amount (AED)', 'Status', 'Issue Date'],
          rows: lpEntries.map(l => [
            l.lpoNumber, l.vendor, l.description,
            l.amount.toLocaleString('en', { minimumFractionDigits: 2 }),
            l.status, l.issueDate,
          ]),
        },
      },
    ])
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
  }

  // ── SITE OVERVIEW (default) ───────────────────────────────────
  const wlConds = [eq(workLogs.siteId, siteId)]
  if (from) wlConds.push(gte(workLogs.date, from))
  if (to)   wlConds.push(lte(workLogs.date, to))

  const [wRows, mlRows, attRows, accRows] = await Promise.all([
    db.select({ log: workLogs, workType: workTypes, supervisor: users }).from(workLogs)
      .leftJoin(workTypes, eq(workLogs.workTypeId, workTypes.id))
      .leftJoin(users, eq(workLogs.userId, users.id))
      .where(and(...wlConds)).orderBy(workLogs.date),
    db.select({ log: materialLogs, material: materials }).from(materialLogs)
      .leftJoin(materials, eq(materialLogs.materialId, materials.id))
      .where(eq(materialLogs.siteId, siteId)).orderBy(materialLogs.date),
    db.select({ att: attendance, worker: labour }).from(attendance)
      .leftJoin(labour, eq(attendance.labourId, labour.id))
      .where(eq(attendance.siteId, siteId)).orderBy(attendance.date),
    db.select().from(accounting).where(eq(accounting.siteId, siteId)).orderBy(accounting.date),
  ])

  if (format === 'csv') {
    const csv = toCSV(
      wRows.map(({ log, workType, supervisor }) => ({
        date: log.date, workType: workType?.name ?? '', unit: workType?.unit ?? '',
        quantity: log.quantity.toString(), supervisor: supervisor?.name ?? '', notes: log.description ?? '',
      })),
      [
        { key: 'date', label: 'Date' }, { key: 'workType', label: 'Work Type' },
        { key: 'unit', label: 'Unit' }, { key: 'quantity', label: 'Quantity' },
        { key: 'supervisor', label: 'Supervisor' }, { key: 'notes', label: 'Notes' },
      ]
    )
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="site-${siteId}.csv"` } })
  }

  const totalIncome  = accRows.filter(a => a.type === 'INCOME').reduce((s, a) => s + a.amount, 0)
  const totalExpense = accRows.filter(a => a.type === 'EXPENSE').reduce((s, a) => s + a.amount, 0)

  const html = buildPDFHTML('Site Overview Report', site.name, [
    {
      heading: `Work Logs (${wRows.length} entries)`,
      table: {
        columns: ['Date', 'Work Type', 'Unit', 'Quantity', 'Supervisor', 'Notes'],
        rows: wRows.map(({ log, workType, supervisor }) => [
          log.date, workType?.name ?? '', workType?.unit ?? '',
          log.quantity.toString(), supervisor?.name ?? '', log.description ?? '-',
        ]),
      },
    },
    {
      heading: 'Material Logs',
      table: {
        columns: ['Date', 'Material', 'Type', 'Quantity', 'Unit Price', 'Total'],
        rows: mlRows.map(({ log, material }) => [
          log.date, material?.name ?? '', log.type,
          `${log.quantity} ${material?.unit ?? ''}`,
          log.unitPrice ? `AED ${log.unitPrice.toFixed(2)}` : '-',
          log.unitPrice ? `AED ${(log.quantity * log.unitPrice).toFixed(2)}` : '-',
        ]),
      },
    },
    {
      heading: `Attendance (${attRows.filter(r => r.att.status === 'PRESENT').length} present of ${attRows.length})`,
      table: {
        columns: ['Date', 'Worker', 'Trade', 'Status', 'Half Day'],
        rows: attRows.map(({ att, worker }) => [
          att.date, worker?.name ?? '', worker?.trade ?? '', att.status, att.halfDay ? 'Yes' : 'No',
        ]),
      },
    },
    {
      heading: `Financials — Income: AED ${totalIncome.toLocaleString()} | Expenses: AED ${totalExpense.toLocaleString()} | Net: AED ${(totalIncome - totalExpense).toLocaleString()}`,
      table: {
        columns: ['Date', 'Type', 'Category', 'Amount (AED)', 'Mode'],
        rows: accRows.map(a => [
          a.date, a.type, a.category,
          a.amount.toLocaleString('en', { minimumFractionDigits: 2 }),
          a.paymentMode,
        ]),
      },
    },
  ])
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}
