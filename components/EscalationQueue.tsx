'use client'

import { useState, useEffect } from 'react'

interface Escalation {
  id: string
  product_category: string | null
  question: string
  status: 'open' | 'answered'
  staff_answer: string | null
  answered_at: string | null
  learned: boolean
  created_at: string
}

export default function EscalationQueue() {
  const [items, setItems] = useState<Escalation[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/repair/escalations')
    const data = await res.json()
    setItems(data.escalations ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function submit(id: string) {
    const answer = drafts[id]?.trim()
    if (!answer) return
    setSubmitting(id)
    setError('')
    try {
      const res = await fetch('/api/repair/escalations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, answer }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '送出失敗')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(null)
    }
  }

  const open = items.filter((i) => i.status === 'open')
  const answered = items.filter((i) => i.status === 'answered')

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">待處理（{open.length}）</h2>
        {open.length === 0 && <p className="text-sm text-gray-400">目前沒有待處理的問題</p>}
        <div className="space-y-3">
          {open.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="text-sm text-gray-900">{item.question}</div>
              {item.product_category && <div className="text-xs text-gray-400">品類：{item.product_category}</div>}
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm h-20"
                placeholder="輸入答案，送出後會存回知識庫，下次同類問題 AI 可以直接回答"
                value={drafts[item.id] ?? ''}
                onChange={(e) => setDrafts({ ...drafts, [item.id]: e.target.value })}
              />
              <button
                onClick={() => submit(item.id)}
                disabled={submitting === item.id || !drafts[item.id]?.trim()}
                className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white disabled:opacity-40"
              >
                {submitting === item.id ? '送出中…' : '回答並存入知識庫'}
              </button>
            </div>
          ))}
        </div>
        {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">已回答（{answered.length}）</h2>
        <div className="space-y-2">
          {answered.map((item) => (
            <div key={item.id} className="border border-gray-100 rounded-md px-3 py-2 text-sm">
              <div className="text-gray-500">Q：{item.question}</div>
              <div className="text-gray-900 mt-1">A：{item.staff_answer}</div>
              <div className="text-xs text-gray-400 mt-1">{item.learned ? '已存入知識庫' : '尚未存入知識庫'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
