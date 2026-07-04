'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STAGE_LABEL: Record<string, string> = {
  collecting: '了解問題中',
  recommending: '已找到建議零件',
  confirmed: '處理採購中',
  escalated: '已轉交同仁確認',
  done: '完成',
}

export default function RepairChatWidget() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '請描述客人的車輛與故障狀況，例如：「Trek 車架，2022 年款，前撥鏈器故障」。' },
  ])
  const [stage, setStage] = useState('collecting')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res = await fetch('/api/repair/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '發生錯誤')

      setSessionId(data.sessionId)
      setStage(data.stage)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white flex flex-col h-[560px]">
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">維修助理</span>
        <span className="text-gray-400">{STAGE_LABEL[stage] ?? stage}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-gray-400">思考中…</div>}
        <div ref={bottomRef} />
      </div>

      {error && <div className="px-4 py-2 text-xs text-red-600 border-t border-red-100">{error}</div>}

      <div className="border-t border-gray-100 p-3 flex gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          placeholder="描述維修問題…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white disabled:opacity-40"
        >
          送出
        </button>
      </div>
    </div>
  )
}
