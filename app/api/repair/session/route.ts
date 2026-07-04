import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'
import { getUserKeys } from '@/lib/user-keys'
import { postRepairMessage, getRepairSession, listRepairSessions } from '@/lib/repair-assistant'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId } = JSON.parse(raw)

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (sessionId) {
    const session = await getRepairSession(userId, sessionId)
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ session })
  }

  const sessions = await listRepairSessions(userId)
  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId } = JSON.parse(raw)

  const { sessionId, message } = await req.json()
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: '請輸入訊息內容' }, { status: 400 })
  }

  try {
    const [userRow] = await sql`SELECT patisco_jwt, patisco_api_key FROM users WHERE id = ${userId}`
    const { anthropicApiKey, openaiApiKey } = await getUserKeys(userId)

    const result = await postRepairMessage({
      userId,
      sessionId: sessionId ?? null,
      userMessage: message,
      anthropicApiKey,
      openaiApiKey,
      patiscoJwt: userRow?.patisco_jwt as string | undefined,
      patiscoApiKey: userRow?.patisco_api_key as string | undefined,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('Repair session error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
