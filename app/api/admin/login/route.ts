import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) return NextResponse.json({ error: '請輸入帳號密碼' }, { status: 400 })

  const [row] = await sql`SELECT id, email, password_hash, role FROM users WHERE email = ${email} AND role = 'admin'`
  if (!row) return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })

  const ok = await bcrypt.compare(password, row.password_hash as string)
  if (!ok) return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })

  const store = await cookies()
  store.set('admin_session', JSON.stringify({ adminId: row.id, email: row.email }), {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 8,
    sameSite: 'lax',
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const store = await cookies()
  store.delete('admin_session')
  return NextResponse.json({ ok: true })
}
