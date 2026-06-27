'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (res.ok) {
      router.push('/admin/dashboard')
    } else {
      const data = await res.json()
      setError(data.error ?? '登入失敗')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 w-full max-w-sm shadow-sm">
        <div className="mb-6">
          <div className="text-xs font-mono text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Pacture Admin</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">後台登入</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="admin@pacture.tw"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">密碼</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? '登入中...' : '進入後台'}
          </button>
        </form>
      </div>
    </div>
  )
}
