import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT id, email, role, status, service_tier, created_at
    FROM users
    ORDER BY created_at DESC
  `
  return NextResponse.json({ users: rows })
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, action, serviceTier } = await req.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  if (action === 'activate') {
    await sql`UPDATE users SET status = 'active' WHERE id = ${userId}`
  } else if (action === 'suspend') {
    await sql`UPDATE users SET status = 'suspended' WHERE id = ${userId}`
  } else if (action === 'set_tier' && serviceTier) {
    await sql`UPDATE users SET service_tier = ${serviceTier} WHERE id = ${userId}`
  } else {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  await sql`DELETE FROM users WHERE id = ${userId} AND role != 'admin'`
  return NextResponse.json({ ok: true })
}
