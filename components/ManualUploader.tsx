'use client'

import { useState, useEffect } from 'react'

interface Manual {
  id: string
  product_category: string
  title: string
  filename: string
  status: 'processing' | 'ready' | 'failed'
  error: string | null
  chunk_count: number
  uploaded_at: string
}

type Mode = 'pdf' | 'url' | 'text'

export default function ManualUploader() {
  const [manuals, setManuals] = useState<Manual[]>([])
  const [mode, setMode] = useState<Mode>('pdf')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/repair/manuals')
    const data = await res.json()
    setManuals(data.manuals ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function upload() {
    const hasContent = mode === 'pdf' ? !!file : mode === 'url' ? !!url.trim() : !!text.trim()
    if (!hasContent || !title.trim() || !category.trim()) {
      setError('請填寫標題、品類，並提供對應的內容')
      return
    }
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      if (mode === 'pdf' && file) form.append('file', file)
      if (mode === 'url') form.append('url', url.trim())
      if (mode === 'text') form.append('text', text.trim())
      form.append('title', title.trim())
      form.append('productCategory', category.trim())
      const res = await fetch('/api/repair/manuals', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '上傳失敗')
      setTitle('')
      setCategory('')
      setFile(null)
      setUrl('')
      setText('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex gap-1 text-sm">
          {([
            ['pdf', 'PDF 手冊'],
            ['url', '網址'],
            ['text', '貼上文字'],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md ${mode === m ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            className="border border-gray-200 rounded-md px-3 py-2 text-sm"
            placeholder="標題，例如：ENVE 墜車折扣重購方案"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="border border-gray-200 rounded-md px-3 py-2 text-sm"
            placeholder="品類，例如：frame / rim / general"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        {mode === 'pdf' && (
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        )}
        {mode === 'url' && (
          <input
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            placeholder="https://enve.com/pages/warranty-terms"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}
        {mode === 'text' && (
          <textarea
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm h-32"
            placeholder="貼上政策內容或手冊文字（適合被防爬蟲擋掉、無法直接用網址抓取的頁面）"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}

        {error && <div className="text-xs text-red-600">{error}</div>}
        <button
          onClick={upload}
          disabled={uploading}
          className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white disabled:opacity-40"
        >
          {uploading ? '解析中…（可能需要一點時間）' : '上傳並解析'}
        </button>
      </div>

      <div className="space-y-2">
        {manuals.length === 0 && <p className="text-sm text-gray-400">尚未上傳任何手冊</p>}
        {manuals.map((m) => (
          <div key={m.id} className="border border-gray-100 rounded-md px-3 py-2 flex items-center justify-between text-sm">
            <div>
              <div className="text-gray-900">{m.title} <span className="text-gray-400">· {m.product_category}</span></div>
              {m.status === 'failed' && <div className="text-xs text-red-500">{m.error}</div>}
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                m.status === 'ready'
                  ? 'bg-green-50 text-green-700'
                  : m.status === 'failed'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {m.status === 'ready' ? `已就緒 · ${m.chunk_count} 段` : m.status === 'failed' ? '解析失敗' : '處理中'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
