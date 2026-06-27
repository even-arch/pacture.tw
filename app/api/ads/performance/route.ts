import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

export interface AdMetrics {
  platform: 'google' | 'meta'
  campaignId?: string
  sku: string
  specification: string
  adFormat: string
  countryCode: string
  impressions: number
  clicks: number
  ctr: number        // %
  spend: number      // USD
  currency: string
  publishedAt: string
}

export interface PerformanceResult {
  connected: { google: boolean; meta: boolean }
  metrics: AdMetrics[]
  lastSyncAt: string | null
}

async function fetchMetaInsights(token: string, accountId: string): Promise<AdMetrics[]> {
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`
  const fields = 'campaign_name,impressions,clicks,spend,actions,ad_id'
  const url = `https://graph.facebook.com/v21.0/${id}/insights?fields=${fields}&date_preset=last_30d&access_token=${token}`

  const res = await fetch(url)
  const data = await res.json()

  if (!res.ok || data.error) {
    console.error('Meta API error:', data.error?.message ?? data)
    return []
  }

  return (data.data ?? []).map((item: Record<string, unknown>) => ({
    platform: 'meta' as const,
    campaignId: item.campaign_id as string,
    sku: '',
    specification: (item.campaign_name as string) ?? '',
    adFormat: 'feed',
    countryCode: '',
    impressions: Number(item.impressions ?? 0),
    clicks: Number(item.clicks ?? 0),
    ctr: Number(item.impressions) > 0 ? (Number(item.clicks) / Number(item.impressions)) * 100 : 0,
    spend: Number(item.spend ?? 0),
    currency: 'USD',
    publishedAt: '',
  }))
}

async function fetchGoogleAdsMetrics(_token: string, _customerId: string): Promise<AdMetrics[]> {
  // Google Ads API requires OAuth2 + developer token setup
  // Stub: returns empty until OAuth flow is implemented
  return []
}

export async function GET() {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = JSON.parse(raw)

  const [user] = await sql`
    SELECT meta_access_token, meta_ad_account_id,
           google_ads_developer_token, google_ads_customer_id
    FROM users WHERE id = ${userId}
  `

  const hasGoogle = !!(user?.google_ads_developer_token && user?.google_ads_customer_id)
  const hasMeta   = !!(user?.meta_access_token && user?.meta_ad_account_id)

  const metrics: AdMetrics[] = []

  if (hasMeta) {
    const metaData = await fetchMetaInsights(
      user.meta_access_token as string,
      user.meta_ad_account_id as string
    ).catch(() => [])
    metrics.push(...metaData)
  }

  if (hasGoogle) {
    const googleData = await fetchGoogleAdsMetrics(
      user.google_ads_developer_token as string,
      user.google_ads_customer_id as string
    ).catch(() => [])
    metrics.push(...googleData)
  }

  return NextResponse.json({
    connected: { google: hasGoogle, meta: hasMeta },
    metrics,
    lastSyncAt: metrics.length > 0 ? new Date().toISOString() : null,
  } satisfies PerformanceResult)
}
