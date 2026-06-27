'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="text-gray-400 hover:text-gray-700 transition-colors"
    >
      登出
    </button>
  )
}
