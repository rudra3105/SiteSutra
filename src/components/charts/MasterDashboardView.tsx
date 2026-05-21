'use client'

function inr(n: number) {
  if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n/100000).toFixed(1)}L`
  if (n >= 1000)     return `₹${(n/1000).toFixed(0)}K`
  return `₹${n.toFixed(0)}`
}

function Stat({ label, value, sub, color }: { label:string; value:string; sub?:string; color:string }) {
  return (
    <div className="card p-4">
      <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

export function MasterDashboardView({ dashboard }: { dashboard: any }) {
  const net = dashboard?.netAmount ?? 0
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <Stat label="Total Sites"    value={String(dashboard?.totalSites ?? 0)}       sub={`${dashboard?.activeSites ?? 0} active`} color="text-blue-700" />
      <Stat label="Total Budget"   value={inr(dashboard?.totalBudget  ?? 0)}         color="text-slate-800" />
      <Stat label="Total Income"   value={inr(dashboard?.totalIncome  ?? 0)}         color="text-emerald-700" />
      <Stat label="Total Expenses" value={inr(dashboard?.totalExpense ?? 0)}         color="text-red-700" />
      <Stat label="Net P&L"        value={inr(Math.abs(net))} sub={net>=0?'▲ Profit':'▼ Loss'} color={net>=0?'text-emerald-700':'text-red-700'} />
    </div>
  )
}
