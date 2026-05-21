export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from 'next/server'
import { createUser, getAllUsers, updateUser, deleteUser } from '@/actions/users'
import { requireAdmin } from '@/lib/auth/session'

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await getAllUsers()
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const user = await createUser(body)
  return NextResponse.json(user)
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, ...data } = body
  const user = await updateUser(id, data)
  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await deleteUser(id)
  return NextResponse.json({ success: true })
}
