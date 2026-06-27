import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const store = await cookies()
  const raw = store.get('session')?.value
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!

  if (!raw) return NextResponse.redirect(`${baseUrl}/login`)

  const { userId } = JSON.parse(raw)
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?meta_error=cancelled`)
  }

  // Load App ID + Secret from admin_keys
  const keys = await sql`SELECT key_name, key_value FROM admin_keys WHERE key_name IN ('meta_app_id', 'meta_app_secret')`
  const appId = keys.find((r) => r.key_name === 'meta_app_id')?.key_value as string
  const appSecret = keys.find((r) => r.key_name === 'meta_app_secret')?.key_value as string

  if (!appId || !appSecret) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?meta_error=config`)
  }

  const redirectUri = `${baseUrl}/api/auth/meta/callback`

  // Exchange code for short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }),
  )
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?meta_error=token`)
  }

  // Exchange for long-lived token (60 days)
  const longRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: tokenData.access_token,
      }),
  )
  const longData = await longRes.json()
  const finalToken = longData.access_token ?? tokenData.access_token

  // Fetch ad accounts so user can pick one
  const adRes = await fetch(
    `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_id&access_token=${finalToken}`,
  )
  const adData = await adRes.json()
  const firstAccount = adData.data?.[0]

  // Save token (and first ad account if only one)
  await sql`UPDATE users SET meta_access_token = ${finalToken} WHERE id = ${userId}`
  if (firstAccount) {
    await sql`UPDATE users SET meta_ad_account_id = ${firstAccount.id} WHERE id = ${userId}`
  }

  return NextResponse.redirect(`${baseUrl}/dashboard/settings?meta_connected=1`)
}
