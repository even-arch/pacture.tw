import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email, name, company, message } = await req.json().catch(() => ({}))
  if (!email) return NextResponse.json({ error: '請輸入 Email' }, { status: 400 })

  const [existing] = await sql`SELECT id FROM access_requests WHERE email = ${email} AND status = 'pending'`
  if (existing) return NextResponse.json({ error: '你的申請已在審核中' }, { status: 409 })

  await sql`
    INSERT INTO access_requests (email, name, company, message)
    VALUES (${email}, ${name ?? null}, ${company ?? null}, ${message ?? null})
  `
  return NextResponse.json({ ok: true })
}
