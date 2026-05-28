export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { getAllEntriesBySite } from "@/actions/cashbook"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const siteId   = searchParams.get("siteId")
  const category = searchParams.get("category") || undefined
  const dateFrom = searchParams.get("dateFrom") || undefined
  const dateTo   = searchParams.get("dateTo")   || undefined
  const type     = searchParams.get("type")     || undefined
  if (!siteId) return NextResponse.json({ error: "siteId required" }, { status: 400 })
  const entries = await getAllEntriesBySite(siteId, { category, dateFrom, dateTo, type })
  const income  = entries.filter((e:any) => e.type === "OUT").reduce((s:number,e:any) => s + e.amount, 0)
  const expense = entries.filter((e:any) => e.type !== "OUT").reduce((s:number,e:any) => s + e.amount, 0)
  return NextResponse.json({ entries, income, expense, net: income - expense })
}
