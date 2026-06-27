'use client'

import { useState } from 'react'

export default function RequestAccessPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/access-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, company, message }),
    })
    if (res.ok) {
      setDone(true)
    } else {
      const data = await res.json()
      setError(data.error ?? '發生錯誤，請稍後再試')
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">申請已送出</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            我們收到你的申請了，將盡快與你聯絡。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">申請使用 Pacture</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            目前採邀請制，填寫申請後由管理員審核開通
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">姓名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="王小明"
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">公司 / 品牌名稱</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="你的公司或品牌"
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">簡單說明你的需求（選填）</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="例如：我們是台灣製造商，想透過 AI 分析訂單資料來優化廣告投放..."
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 placeholder-gray-400 resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg py-2 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            {loading ? '送出中...' : '送出申請'}
          </button>
        </form>
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-4">
          已有帳號？{' '}
          <a href="/login" className="underline hover:text-gray-600 dark:hover:text-gray-400">
            直接登入
          </a>
        </p>
      </div>
    </div>
  )
}
