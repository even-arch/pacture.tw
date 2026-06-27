'use client'

import { useState, useEffect, useCallback } from 'react'
import CopyCard from './CopyCard'

interface Draft {
  id: string
  sku: string
  specification: string
  country_code: string
  platform: string
  ad_format: string
  extra_note: string | null
  versions: Array<{ version: number; tone: string; copy: string; fields?: Record<string, string> }>
  created_at: string
}

const PLATFORM_LABEL: Record<string, string> = { google: 'Google', meta: 'Meta' }
const FORMAT_LABEL: Record<string, string> = {
  search: '關鍵字', display: '展示', youtube: 'YouTube',
  feed: '動態', stories: '限時', reels: 'Reels',
}
const COUNTRY_FLAGS: Record<string, string> = {
  TW: '🇹🇼', JP: '🇯🇵', CA: '🇨🇦', US: '🇺🇸', DE: '🇩🇪',
  FR: '🇫🇷', GB: '🇬🇧', AU: '🇦🇺', HK: '🇭🇰',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m} 分鐘前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小時前`
  return `${Math.floor(h / 24)} 天前`
}

export default function DraftsList() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/drafts')
    const data = await res.json()
    setDrafts(data.drafts ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch('/api/drafts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDrafts(prev => prev.filter(d => d.id !== id))
    if (expanded === id) setExpanded(null)
    setDeleting(null)
  }

  if (loading) {
    return <div className="h-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl animate-pulse" />
  }

  if (drafts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-8 text-center text-sm text-gray-400">
        尚無已儲存的文案。點「立即生成」後文案會自動保存在此。
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {drafts.map(d => (
        <div key={d.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div
            className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 select-none"
            onClick={() => setExpanded(expanded === d.id ? null : d.id)}
          >
            <span className="text-gray-300 dark:text-gray-600 text-xs">{expanded === d.id ? '▼' : '▶'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{d.sku}</span>
                <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {COUNTRY_FLAGS[d.country_code] ?? ''} {d.country_code}
                </span>
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                  {PLATFORM_LABEL[d.platform] ?? d.platform} {FORMAT_LABEL[d.ad_format] ?? d.ad_format}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate mt-0.5">{d.specification}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-gray-300 dark:text-gray-600">{timeAgo(d.created_at)}</span>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(d.id) }}
                disabled={deleting === d.id}
                className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 px-1"
              >
                刪除
              </button>
            </div>
          </div>
          {expanded === d.id && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4 grid gap-3">
              {d.versions.map(v => (
                <CopyCard key={v.version} {...v} platform={d.platform} adFormat={d.ad_format} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
