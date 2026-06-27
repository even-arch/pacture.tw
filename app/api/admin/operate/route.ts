import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAdminSession } from '@/lib/admin-auth'
import { listProformaInvoices, getOrderDetail, createSession } from '@/lib/patisco-mcp'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const adminSession = await getAdminSession()
  if (!adminSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, action } = await req.json().catch(() => ({}))
  if (!userId || !action) return NextResponse.json({ error: 'userId and action required' }, { status: 400 })

  const [userRow] = await sql`SELECT id, email, service_tier, patisco_jwt, patisco_api_key FROM users WHERE id = ${userId}`
  if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (action === 'sync') {
    const jwt = userRow.patisco_jwt as string
    const apiKey = userRow.patisco_api_key as string
    if (!jwt || !apiKey) return NextResponse.json({ error: '該用戶尚未設定 Patisco 憑證' }, { status: 422 })

    const { items, totalCount, statusBreakdown } = await listProformaInvoices(jwt, apiKey)
    const session = await createSession(jwt, apiKey)

    let synced = 0, failed = 0
    for (let i = 0; i < items.length; i++) {
      const pi = items[i]
      try {
        const detail = await getOrderDetail(session, pi.id, i + 10)
        const customerCountry = detail.buyer?.countryCode ?? detail.shippingInfo?.countryCode ?? null
        const categories = [...new Set((detail.products ?? []).map((p: { sku?: string }) => p.sku).filter(Boolean))]
        const statusMap: Record<string, string> = { '3': 'confirmed', '2': 'archived', '1': 'pending', '0': 'draft' }

        await sql`
          INSERT INTO proforma_invoices (user_id, pi_id, pi_no, po_id, po_no, product_categories, customer_region, customer_language, status, raw_data, synced_at)
          VALUES (${userId}, ${pi.id}, ${pi.no}, ${pi.po?.id ?? null}, ${pi.po?.no ?? null}, ${categories}, ${customerCountry}, ${null}, ${statusMap[pi.status] ?? pi.status}, ${detail as never}, now())
          ON CONFLICT (user_id, pi_id) DO UPDATE SET
            product_categories = EXCLUDED.product_categories,
            customer_region    = EXCLUDED.customer_region,
            status             = EXCLUDED.status,
            raw_data           = EXCLUDED.raw_data,
            synced_at          = now()
        `
        synced++
      } catch { failed++ }
    }

    return NextResponse.json({ ok: true, synced, failed, totalCount, statusBreakdown })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
