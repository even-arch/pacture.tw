import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

export async function GET() {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL!))

  const [adminKey] = await sql`SELECT key_value FROM admin_keys WHERE key_name = 'meta_app_id'`
  const appId = adminKey?.key_value as string
  if (!appId) return NextResponse.json({ error: 'Meta App ID 尚未設定，請聯絡管理員' }, { status: 500 })

  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/meta/callback`
  const scope = 'ads_management,ads_read,business_management,pages_read_engagement'

  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scope)
  url.searchParams.set('response_type', 'code')

  return NextResponse.redirect(url.toString())
}
