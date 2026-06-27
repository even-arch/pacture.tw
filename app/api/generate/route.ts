import { NextRequest, NextResponse } from 'next/server'
import { generateCopy } from '@/lib/claude'
import { getUserKeys } from '@/lib/user-keys'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = JSON.parse(raw)
  const { anthropicApiKey } = await getUserKeys(userId)

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { sku, specification, unit, countryCode, platform, adFormat, extraNote, userPrompt } = body

  if (!sku || !specification || !countryCode || !platform || !adFormat) {
    return NextResponse.json({ error: 'Missing required fields: sku, specification, countryCode, platform, adFormat' }, { status: 400 })
  }

  if (!anthropicApiKey) {
    return NextResponse.json({ error: '請先至「設定」頁面設定 Anthropic API Key' }, { status: 422 })
  }

  try {
    const versions = await generateCopy({ sku, specification, unit, countryCode, platform, adFormat, extraNote, userPrompt, anthropicApiKey })

    // Auto-save to drafts
    await sql`
      INSERT INTO copy_drafts (user_id, sku, specification, country_code, platform, ad_format, extra_note, versions, status)
      VALUES (${userId}, ${sku}, ${specification}, ${countryCode}, ${platform}, ${adFormat}, ${extraNote ?? null}, ${JSON.stringify(versions) as unknown as never}, 'draft')
    `

    return NextResponse.json({ versions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
