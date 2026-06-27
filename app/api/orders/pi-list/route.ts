import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

export interface PIProduct {
  sku: string
  specification: string
  unit: string | null
}

export interface PIListItem {
  piId: string
  piNo: string
  buyerName: string
  countryCode: string
  products: PIProduct[]
}

export async function GET() {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = JSON.parse(raw)

  const rows = await sql`
    SELECT
      pi_id,
      pi_no,
      raw_data->'buyer'->>'name'        AS buyer_name,
      raw_data->'buyer'->>'countryCode'  AS country_code,
      raw_data->'products'               AS products
    FROM proforma_invoices
    WHERE user_id = ${userId}
    ORDER BY synced_at DESC
  `

  const items: PIListItem[] = rows.map((r) => ({
    piId: r.pi_id as string,
    piNo: r.pi_no as string,
    buyerName: (r.buyer_name as string) ?? '—',
    countryCode: (r.country_code as string) ?? '',
    products: ((r.products as PIProduct[]) ?? []).map((p) => ({
      sku: p.sku,
      specification: p.specification,
      unit: p.unit ?? null,
    })),
  }))

  return NextResponse.json({ items })
}
