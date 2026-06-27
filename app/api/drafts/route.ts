import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

export async function GET() {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = JSON.parse(raw)

  const rows = await sql`
    SELECT id, sku, specification, country_code, platform, ad_format, extra_note,
           versions, created_at
    FROM copy_drafts
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 100
  `
  return NextResponse.json({ drafts: rows })
}

export async function DELETE(req: NextRequest) {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = JSON.parse(raw)
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await sql`DELETE FROM copy_drafts WHERE id = ${id} AND user_id = ${userId}`
  return NextResponse.json({ ok: true })
}
