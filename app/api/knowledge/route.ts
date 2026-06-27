import { NextRequest, NextResponse } from 'next/server'
import { ragQuery } from '@/lib/embeddings'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? 'general'
  const query = searchParams.get('query') ?? category

  const results = await ragQuery(category, query)
  return NextResponse.json({ results })
}
