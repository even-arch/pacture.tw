import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export interface Session {
  userId: string
  email: string
  serviceTier?: string
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}
