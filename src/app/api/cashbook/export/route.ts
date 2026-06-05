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
  const party    = searchParams.get("party")    || undefined
  if (!siteId) return NextResponse.json({ error: "siteId required" }, { status: 400 })
  const result = await getAllEntriesBySite(siteId, { category, dateFrom, dateTo, type, party })
  return NextResponse.json(result)
}
