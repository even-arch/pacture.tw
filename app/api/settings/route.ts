import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

function mask(key: string | null): string | null {
  if (!key) return null
  return key.slice(0, 8) + '••••••••••••' + key.slice(-4)
}

export async function GET() {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = JSON.parse(raw)
  const [row] = await sql`SELECT * FROM users WHERE id = ${userId}`

  return NextResponse.json({
    patiscoJwt:     { masked: mask(row?.patisco_jwt as string | null),          set: !!row?.patisco_jwt },
    patiscoApiKey:  { masked: mask(row?.patisco_api_key as string | null),     set: !!row?.patisco_api_key },
    anthropicKey:   { masked: mask(row?.anthropic_api_key as string | null),   set: !!row?.anthropic_api_key },
    openaiKey:      { masked: mask(row?.openai_api_key as string | null),       set: !!row?.openai_api_key },
    firecrawlKey:   { masked: mask(row?.firecrawl_api_key as string | null),    set: !!row?.firecrawl_api_key },
    googleAdsToken: { masked: mask(row?.google_ads_developer_token as string | null), set: !!row?.google_ads_developer_token },
    googleCustomerId: { value: (row?.google_ads_customer_id as string | null) ?? '', set: !!row?.google_ads_customer_id },
    metaToken:      { masked: mask(row?.meta_access_token as string | null),    set: !!row?.meta_access_token },
    metaAccountId:  { value: (row?.meta_ad_account_id as string | null) ?? '', set: !!row?.meta_ad_account_id },
    preferredCopyModel:          (row?.preferred_copy_model as string) ?? 'anthropic',
    preferredEmbeddingProvider:  (row?.preferred_embedding_provider as string) ?? 'openai',
    serviceTier:                 (row?.service_tier as string) ?? 'self',
  })
}

export async function PUT(req: NextRequest) {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = JSON.parse(raw)
  const body = await req.json().catch(() => ({}))

  const updates: Record<string, string | null> = {}
  if (body.patiscoJwt        !== undefined) updates.patisco_jwt                 = body.patiscoJwt        || null
  if (body.patiscoApiKey     !== undefined) updates.patisco_api_key             = body.patiscoApiKey     || null
  if (body.anthropicKey      !== undefined) updates.anthropic_api_key          = body.anthropicKey      || null
  if (body.openaiKey         !== undefined) updates.openai_api_key             = body.openaiKey         || null
  if (body.firecrawlKey      !== undefined) updates.firecrawl_api_key          = body.firecrawlKey      || null
  if (body.googleAdsToken    !== undefined) updates.google_ads_developer_token = body.googleAdsToken    || null
  if (body.googleCustomerId  !== undefined) updates.google_ads_customer_id     = body.googleCustomerId  || null
  if (body.metaToken         !== undefined) updates.meta_access_token          = body.metaToken         || null
  if (body.metaAccountId     !== undefined) updates.meta_ad_account_id         = body.metaAccountId     || null
  if (body.preferredCopyModel         !== undefined) updates.preferred_copy_model          = body.preferredCopyModel
  if (body.preferredEmbeddingProvider !== undefined) updates.preferred_embedding_provider  = body.preferredEmbeddingProvider

  // Build update using safe column allowlist
  const ALLOWED: Record<string, string> = {
    patisco_jwt: 'patisco_jwt',
    patisco_api_key: 'patisco_api_key',
    anthropic_api_key: 'anthropic_api_key',
    openai_api_key: 'openai_api_key',
    firecrawl_api_key: 'firecrawl_api_key',
    google_ads_developer_token: 'google_ads_developer_token',
    google_ads_customer_id: 'google_ads_customer_id',
    meta_access_token: 'meta_access_token',
    meta_ad_account_id: 'meta_ad_account_id',
    preferred_copy_model: 'preferred_copy_model',
    preferred_embedding_provider: 'preferred_embedding_provider',
  }
  for (const [col, val] of Object.entries(updates)) {
    if (!ALLOWED[col]) continue
    if (col === 'patisco_jwt')                   await sql`UPDATE users SET patisco_jwt = ${val} WHERE id = ${userId}`
    else if (col === 'patisco_api_key')          await sql`UPDATE users SET patisco_api_key = ${val} WHERE id = ${userId}`
    else if (col === 'anthropic_api_key')          await sql`UPDATE users SET anthropic_api_key = ${val} WHERE id = ${userId}`
    else if (col === 'openai_api_key')        await sql`UPDATE users SET openai_api_key = ${val} WHERE id = ${userId}`
    else if (col === 'firecrawl_api_key')     await sql`UPDATE users SET firecrawl_api_key = ${val} WHERE id = ${userId}`
    else if (col === 'google_ads_developer_token') await sql`UPDATE users SET google_ads_developer_token = ${val} WHERE id = ${userId}`
    else if (col === 'google_ads_customer_id')await sql`UPDATE users SET google_ads_customer_id = ${val} WHERE id = ${userId}`
    else if (col === 'meta_access_token')     await sql`UPDATE users SET meta_access_token = ${val} WHERE id = ${userId}`
    else if (col === 'meta_ad_account_id')    await sql`UPDATE users SET meta_ad_account_id = ${val} WHERE id = ${userId}`
    else if (col === 'preferred_copy_model')  await sql`UPDATE users SET preferred_copy_model = ${val} WHERE id = ${userId}`
    else if (col === 'preferred_embedding_provider') await sql`UPDATE users SET preferred_embedding_provider = ${val} WHERE id = ${userId}`
  }

  return NextResponse.json({ ok: true })
}
