import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'email 和密碼為必填' }, { status: 400 })
  }

  try {
    const [existing] = await sql`SELECT id, email, password_hash, status, service_tier FROM users WHERE email = ${email}`

    let userId: string
    let serviceTier = 'self'

    if (!existing) {
      // 第一次登入，自動建立帳號
      const hash = await bcrypt.hash(password, 10)
      const [created] = await sql`
        INSERT INTO users (email, password_hash)
        VALUES (${email}, ${hash})
        RETURNING id
      `
      userId = created.id as string
    } else {
      // 帳號被停用
      if (existing.status === 'suspended') {
        return NextResponse.json({ error: '此帳號已停用，請聯絡管理員' }, { status: 403 })
      }
      // 已有帳號，驗證密碼
      if (!existing.password_hash) {
        // 舊帳號（JWT 時代），直接設密碼
        const hash = await bcrypt.hash(password, 10)
        await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${existing.id}`
      } else {
        const valid = await bcrypt.compare(password, existing.password_hash as string)
        if (!valid) {
          return NextResponse.json({ error: '密碼不正確' }, { status: 401 })
        }
      }
      userId = existing.id as string
      serviceTier = (existing.service_tier as string) ?? 'self'
    }

    const store = await cookies()
    store.set('session', JSON.stringify({ userId, email, serviceTier }), {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    })

    return NextResponse.json({ ok: true, userId, serviceTier })
  } catch (err) {
    console.error('Auth error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE() {
  const store = await cookies()
  store.delete('session')
  return NextResponse.json({ ok: true })
}
