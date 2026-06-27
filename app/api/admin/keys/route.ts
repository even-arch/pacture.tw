import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAdminSession } from '@/lib/admin-auth'

const KEY_NAMES = [
  'anthropic_api_key',
  'openai_api_key',
  'firecrawl_api_key',
  'google_ads_developer_token',
  'google_ads_manager_customer_id',
  'meta_app_id',
  'meta_app_secret',
  'meta_system_user_token',
]

function mask(v: string | null) {
  if (!v) return null
  return v.slice(0, 8) + '••••••••••••' + v.slice(-4)
}

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`SELECT key_name, key_value FROM admin_keys WHERE key_name = ANY(${KEY_NAMES})`
  const map: Record<string, { masked: string | null; set: boolean }> = {}
  for (const name of KEY_NAMES) {
    const row = rows.find((r) => r.key_name === name)
    map[name] = { masked: mask(row?.key_value as string | null), set: !!row?.key_value }
  }
  return NextResponse.json(map)
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  for (const name of KEY_NAMES) {
    if (body[name] !== undefined) {
      const val = body[name] || null
      await sql`
        INSERT INTO admin_keys (key_name, key_value, updated_at)
        VALUES (${name}, ${val}, now())
        ON CONFLICT (key_name) DO UPDATE SET key_value = ${val}, updated_at = now()
      `
    }
  }
  return NextResponse.json({ ok: true })
}
