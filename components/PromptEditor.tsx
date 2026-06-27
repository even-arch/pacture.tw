'use client'

import { useState, useEffect } from 'react'

interface PromptTemplate {
  id: number
  name: string
  platform: string
  content: string
  is_default: boolean
}

interface PromptEditorProps {
  platform?: string
  value: string
  onChange: (val: string) => void
}

export default function PromptEditor({ platform, value, onChange }: PromptEditorProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const url = platform ? `/api/prompts?platform=${platform}` : '/api/prompts'
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const list: PromptTemplate[] = data.templates ?? []
        setTemplates(list)
        // 預填預設模板
        if (!value) {
          const def = list.find((t) => t.is_default) ?? list[0]
          if (def) { setSelectedId(def.id); onChange(def.content) }
        }
      })
  }, [platform]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyTemplate(t: PromptTemplate) {
    setSelectedId(t.id)
    onChange(t.content)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Prompt 指令
          <span className="ml-2 text-xs text-gray-400 font-normal">你可以直接修改後再生成</span>
        </label>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          {expanded ? '收起模板' : '套用模板 ▾'}
        </button>
      </div>

      {/* Template picker */}
      {expanded && templates.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1.5">
          <p className="text-xs text-gray-500 mb-2">選擇後會覆蓋目前的 Prompt</p>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { applyTemplate(t); setExpanded(false) }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                selectedId === t.id
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="font-medium">{t.name}</span>
              {t.is_default && <span className="ml-2 text-indigo-400">（預設）</span>}
              <p className="text-gray-400 mt-0.5 line-clamp-1">{t.content.split('\n')[0]}</p>
            </button>
          ))}
        </div>
      )}

      {/* Editable textarea */}
      <textarea
        value={value}
        onChange={(e) => { onChange(e.target.value); setSelectedId(null) }}
        rows={8}
        className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y placeholder-gray-400"
        placeholder="輸入你對這次文案生成的指令與要求..."
      />
      <p className="text-xs text-gray-400">
        這段 Prompt 會作為指令傳給 AI，越具體越準確。修改後不會影響後台的模板內容。
      </p>
    </div>
  )
}
