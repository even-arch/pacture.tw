import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const store = await cookies()
  if (!store.get('session')?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform')

  const rows = platform
    ? await sql`SELECT * FROM prompt_templates WHERE platform = ${platform} OR platform = 'general' ORDER BY sort_order, id`
    : await sql`SELECT * FROM prompt_templates ORDER BY sort_order, id`

  return NextResponse.json({ templates: rows })
}
