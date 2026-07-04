import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'
import { getUserKeys } from '@/lib/user-keys'
import { extractManualChunks, extractChunksFromText, fetchUrlText } from '@/lib/manual-parser'
import { storeManualChunks } from '@/lib/embeddings'

export const maxDuration = 300

export async function GET() {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT id, product_category, title, filename, status, error, chunk_count, uploaded_at
    FROM repair_manuals
    ORDER BY uploaded_at DESC
  `
  return NextResponse.json({ manuals: rows })
}

export async function POST(req: NextRequest) {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId } = JSON.parse(raw)

  const form = await req.formData()
  const file = form.get('file') as File | null
  const sourceUrl = (form.get('url') as string | null)?.trim()
  const pastedText = (form.get('text') as string | null)?.trim()
  const productCategory = (form.get('productCategory') as string | null)?.trim()
  const title = (form.get('title') as string | null)?.trim()

  if ((!file && !sourceUrl && !pastedText) || !productCategory || !title) {
    return NextResponse.json({ error: '請提供 PDF 檔案／網址／文字其中一種內容，並填寫品類與標題' }, { status: 400 })
  }
  if (file && file.type !== 'application/pdf') {
    return NextResponse.json({ error: '檔案上傳目前只支援 PDF' }, { status: 400 })
  }

  const [manual] = await sql`
    INSERT INTO repair_manuals (uploaded_by, product_category, title, filename, status)
    VALUES (${userId}, ${productCategory}, ${title}, ${file?.name ?? sourceUrl ?? null}, 'processing')
    RETURNING id
  `
  const manualId = manual.id as string

  try {
    const { anthropicApiKey, openaiApiKey } = await getUserKeys(userId)

    const chunks = file
      ? await extractManualChunks(Buffer.from(await file.arrayBuffer()), productCategory, anthropicApiKey)
      : await extractChunksFromText(
          sourceUrl ? await fetchUrlText(sourceUrl) : (pastedText as string),
          productCategory,
          anthropicApiKey
        )
    const stored = await storeManualChunks(manualId, productCategory, chunks, openaiApiKey)

    await sql`
      UPDATE repair_manuals SET status = 'ready', chunk_count = ${stored} WHERE id = ${manualId}
    `
    return NextResponse.json({ id: manualId, status: 'ready', chunkCount: stored })
  } catch (err) {
    console.error('Manual parse error:', err)
    await sql`
      UPDATE repair_manuals SET status = 'failed', error = ${String(err)} WHERE id = ${manualId}
    `
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
