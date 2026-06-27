import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'

export interface PIProduct {
  sku: string
  specification: string
  unit: string | null
  piNo: string
}

export async function GET() {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = JSON.parse(raw)

  // Unnest products array from raw_data across all PIs, deduplicate by SKU
  const rows = await sql`
    SELECT DISTINCT ON (p->>'sku')
      p->>'sku'           AS sku,
      p->>'specification' AS specification,
      p->>'unit'          AS unit,
      pi.pi_no            AS pi_no
    FROM proforma_invoices pi,
         jsonb_array_elements(pi.raw_data->'products') AS p
    WHERE pi.user_id = ${userId}
      AND p->>'sku' IS NOT NULL
      AND p->>'specification' IS NOT NULL
    ORDER BY p->>'sku', pi.synced_at DESC
  `

  return NextResponse.json({ products: rows })
}
