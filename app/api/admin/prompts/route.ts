import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await sql`SELECT * FROM prompt_templates ORDER BY sort_order, id`
  return NextResponse.json({ templates: rows })
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, platform, content, isDefault, sortOrder } = await req.json()
  if (!name || !content) return NextResponse.json({ error: 'name and content required' }, { status: 400 })
  const [row] = await sql`
    INSERT INTO prompt_templates (name, platform, content, is_default, sort_order)
    VALUES (${name}, ${platform ?? 'general'}, ${content}, ${isDefault ?? false}, ${sortOrder ?? 0})
    RETURNING *
  `
  return NextResponse.json({ template: row })
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, name, platform, content, isDefault, sortOrder } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await sql`
    UPDATE prompt_templates
    SET name=${name}, platform=${platform}, content=${content},
        is_default=${isDefault}, sort_order=${sortOrder}, updated_at=now()
    WHERE id=${id}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await sql`DELETE FROM prompt_templates WHERE id=${id}`
  return NextResponse.json({ ok: true })
}
