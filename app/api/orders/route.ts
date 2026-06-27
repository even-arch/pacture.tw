import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

export async function GET() {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = JSON.parse(raw)

  const rows = await sql`
    SELECT
      id, pi_id, pi_no, po_id, po_no,
      product_categories, customer_region,
      status, synced_at,
      raw_data->'buyer'->>'name' AS buyer_name,
      raw_data->>'price' AS price,
      raw_data->>'currencyCode' AS currency_code,
      raw_data->>'itemsCount' AS items_count
    FROM proforma_invoices
    WHERE user_id = ${userId}
    ORDER BY synced_at DESC
  `

  return NextResponse.json({ items: rows })
}
