import { NextRequest, NextResponse } from 'next/server'
import { listProformaInvoices, getOrderDetail, createSession } from '@/lib/patisco-mcp'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

export const maxDuration = 300

export async function POST(_req: NextRequest) {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId } = JSON.parse(raw)

  try {
    const [userRow] = await sql`SELECT patisco_jwt, patisco_api_key FROM users WHERE id = ${userId}`
    const jwt = userRow?.patisco_jwt as string
    const apiKey = userRow?.patisco_api_key as string

    if (!jwt || !apiKey) {
      return NextResponse.json({ error: '請先至「設定」頁面設定 Patisco 憑證' }, { status: 422 })
    }

    const { items, totalCount, statusBreakdown } = await listProformaInvoices(jwt, apiKey)

    // reuse a single MCP session for all getOrderDetail calls
    const session = await createSession(jwt, apiKey)

    let synced = 0
    let failed = 0

    for (let i = 0; i < items.length; i++) {
      const pi = items[i]
      try {
        const detail = await getOrderDetail(session, pi.id, i + 10)

        const customerCountry =
          detail.buyer?.countryCode ?? detail.shippingInfo?.countryCode ?? null

        const categories = [
          ...new Set((detail.products ?? []).map((p) => p.sku).filter(Boolean)),
        ]

        const statusMap: Record<string, string> = {
          '3': 'confirmed',
          '2': 'archived',
          '1': 'pending',
          '0': 'draft',
        }

        await sql`
          INSERT INTO proforma_invoices (
            user_id, pi_id, pi_no, po_id, po_no,
            product_categories, customer_region, customer_language,
            status, raw_data, created_date, synced_at
          ) VALUES (
            ${userId}, ${pi.id}, ${pi.no},
            ${pi.po?.id ?? null}, ${pi.po?.no ?? null},
            ${categories}, ${customerCountry}, ${null},
            ${statusMap[pi.status] ?? pi.status},
            ${detail as never},
            ${pi.createdDate ?? null},
            now()
          )
          ON CONFLICT (user_id, pi_id) DO UPDATE SET
            product_categories = EXCLUDED.product_categories,
            customer_region    = EXCLUDED.customer_region,
            status             = EXCLUDED.status,
            raw_data           = EXCLUDED.raw_data,
            created_date       = EXCLUDED.created_date,
            synced_at          = now()
        `
        synced++
      } catch (err) {
        console.error(`Failed PI ${pi.id}:`, err)
        failed++
      }
    }

    return NextResponse.json({ synced, failed, totalCount, statusBreakdown })
  } catch (err) {
    console.error('Patisco sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
