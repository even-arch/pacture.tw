import { cookies } from 'next/headers'

export async function getAdminSession() {
  const store = await cookies()
  const raw = store.get('admin_session')?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as { adminId: string; email: string }
  } catch {
    return null
  }
}
