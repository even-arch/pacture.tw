'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SyncButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ synced?: number; failed?: number } | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/patisco/sync', { method: 'POST' })
      const data = await res.json()
      setResult(data)
      router.refresh()
    } catch {
      setResult({ synced: 0, failed: 1 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-sm text-gray-500">
          同步完成：{result.synced} 筆
          {result.failed ? `（${result.failed} 筆失敗）` : ''}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={loading}
        className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {loading ? '同步中...' : '同步 Patisco'}
      </button>
    </div>
  )
}
