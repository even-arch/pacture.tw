import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'
import { getUserKeys } from '@/lib/user-keys'
import { storeStaffAnswer } from '@/lib/embeddings'

export async function GET() {
  const store = await cookies()
  if (!store.get('session')?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT id, session_id, product_category, question, status, staff_answer, answered_at, learned, created_at
    FROM repair_escalations
    ORDER BY (status = 'open') DESC, created_at DESC
  `
  return NextResponse.json({ escalations: rows })
}

export async function POST(req: NextRequest) {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId } = JSON.parse(raw)

  const { id, answer } = await req.json()
  if (!id || !answer?.trim()) {
    return NextResponse.json({ error: '請輸入答案' }, { status: 400 })
  }

  const [escalation] = await sql`SELECT question, product_category FROM repair_escalations WHERE id = ${id}`
  if (!escalation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await sql`
    UPDATE repair_escalations
    SET status = 'answered', staff_answer = ${answer.trim()}, answered_by = ${userId}, answered_at = now()
    WHERE id = ${id}
  `

  try {
    const { openaiApiKey } = await getUserKeys(userId)
    await storeStaffAnswer(
      (escalation.product_category as string | null) ?? 'general',
      escalation.question as string,
      answer.trim(),
      openaiApiKey
    )
    await sql`UPDATE repair_escalations SET learned = true WHERE id = ${id}`
  } catch (err) {
    // 答案已經存進 repair_escalations，就算回寫知識庫失敗也不擋住這次回覆，但要留痕方便之後補做
    console.error('Failed to learn from staff answer:', err)
  }

  return NextResponse.json({ ok: true })
}
