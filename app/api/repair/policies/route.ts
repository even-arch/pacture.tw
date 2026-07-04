import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'

export async function GET() {
  const store = await cookies()
  if (!store.get('session')?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`SELECT * FROM warranty_policies ORDER BY product_category`
  return NextResponse.json({ policies: rows })
}

export async function POST(req: NextRequest) {
  const store = await cookies()
  if (!store.get('session')?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    productCategory,
    isWearItem,
    defectLifetime,
    defectYears,
    defectRequiresOriginalOwner,
    defectSubsequentOwnerYears,
    crashDiscountPct,
    crashFreeYears,
    crashRequiresOriginalOwner,
    laborIncluded,
    claimChannel,
    notes,
  } = body

  if (!productCategory) {
    return NextResponse.json({ error: '請填寫品類' }, { status: 400 })
  }

  await sql`
    INSERT INTO warranty_policies (
      product_category, is_wear_item, defect_lifetime, defect_years, defect_requires_original_owner,
      defect_subsequent_owner_years, crash_discount_pct, crash_free_years, crash_requires_original_owner,
      labor_included, claim_channel, notes, updated_at
    ) VALUES (
      ${productCategory}, ${!!isWearItem}, ${!!defectLifetime}, ${defectYears ?? null}, ${defectRequiresOriginalOwner !== false},
      ${defectSubsequentOwnerYears ?? null}, ${crashDiscountPct ?? null}, ${crashFreeYears ?? 0}, ${crashRequiresOriginalOwner !== false},
      ${!!laborIncluded}, ${claimChannel || null}, ${notes || null}, now()
    )
    ON CONFLICT (product_category) DO UPDATE SET
      is_wear_item = EXCLUDED.is_wear_item,
      defect_lifetime = EXCLUDED.defect_lifetime,
      defect_years = EXCLUDED.defect_years,
      defect_requires_original_owner = EXCLUDED.defect_requires_original_owner,
      defect_subsequent_owner_years = EXCLUDED.defect_subsequent_owner_years,
      crash_discount_pct = EXCLUDED.crash_discount_pct,
      crash_free_years = EXCLUDED.crash_free_years,
      crash_requires_original_owner = EXCLUDED.crash_requires_original_owner,
      labor_included = EXCLUDED.labor_included,
      claim_channel = EXCLUDED.claim_channel,
      notes = EXCLUDED.notes,
      updated_at = now()
  `

  return NextResponse.json({ ok: true })
}
