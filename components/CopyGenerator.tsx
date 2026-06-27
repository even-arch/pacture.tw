'use client'

import { useState, useEffect } from 'react'
import CopyCard from './CopyCard'
import PromptEditor from './PromptEditor'

interface PIProduct {
  sku: string
  specification: string
  unit: string | null
}

interface PIListItem {
  piId: string
  piNo: string
  buyerName: string
  countryCode: string
  products: PIProduct[]
}

interface CopyVersion {
  version: number
  tone: string
  copy: string
}

interface ProductResult {
  sku: string
  specification: string
  versions: CopyVersion[]
  error?: string
}

const CHANNELS = [
  { value: 'catalog', label: 'B2B 型錄' },
  { value: 'website', label: '官網商品頁' },
  { value: 'email', label: 'Email Newsletter' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
]

const COUNTRY_LANG: Record<string, string> = {
  TW: 'zh-TW', HK: 'zh-TW', JP: 'ja',
  DE: 'de', AT: 'de', CH: 'de',
  FR: 'fr', BE: 'fr',
}

function countryLabel(cc: string) {
  const lang = COUNTRY_LANG[cc.toUpperCase()] ?? 'en'
  const region = ['TW','HK','MO','CN','SG','MY'].includes(cc.toUpperCase()) ? '亞洲'
    : cc === 'JP' ? '日本'
    : ['US','CA'].includes(cc.toUpperCase()) ? '北美'
    : ['AU','NZ'].includes(cc.toUpperCase()) ? '澳紐'
    : '歐洲'
  return `${cc} · ${region} · ${lang}`
}

export default function CopyGenerator() {
  const [piList, setPiList] = useState<PIListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPiId, setSelectedPiId] = useState('')
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState('catalog')
  const [userPrompt, setUserPrompt] = useState('')
  const [results, setResults] = useState<ProductResult[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/orders/pi-list')
      .then((r) => r.json())
      .then((data) => {
        const items: PIListItem[] = data.items ?? []
        setPiList(items)
        if (items.length > 0) {
          setSelectedPiId(items[0].piId)
          setSelectedSkus(new Set(items[0].products.map((p) => p.sku)))
        }
      })
      .catch(() => setError('無法載入 PI 清單'))
      .finally(() => setLoading(false))
  }, [])

  const selectedPI = piList.find((p) => p.piId === selectedPiId)

  function handlePiChange(piId: string) {
    setSelectedPiId(piId)
    const pi = piList.find((p) => p.piId === piId)
    setSelectedSkus(new Set(pi?.products.map((p) => p.sku) ?? []))
    setResults([])
  }

  function toggleSku(sku: string) {
    setSelectedSkus((prev) => {
      const next = new Set(prev)
      next.has(sku) ? next.delete(sku) : next.add(sku)
      return next
    })
  }

  async function handleGenerate() {
    if (!selectedPI || selectedSkus.size === 0) return
    setGenerating(true)
    setError(null)
    setResults([])

    const products = selectedPI.products.filter((p) => selectedSkus.has(p.sku))
    const out: ProductResult[] = []

    for (const product of products) {
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: product.sku,
            specification: product.specification,
            unit: product.unit,
            countryCode: selectedPI.countryCode,
            platform: channel === 'google' ? 'google' : 'meta',
            adFormat: channel === 'instagram' || channel === 'facebook' ? 'feed' : 'search',
            userPrompt: userPrompt || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Generation failed')
        out.push({ sku: product.sku, specification: product.specification, versions: data.versions })
      } catch (e) {
        out.push({ sku: product.sku, specification: product.specification, versions: [], error: e instanceof Error ? e.message : 'error' })
      }
      // Update progressively
      setResults([...out])
    }

    setGenerating(false)
  }

  if (loading) {
    return <div className="h-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse" />
  }

  if (piList.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-10 text-center text-sm text-gray-400 dark:text-gray-500">
        尚無 PI 資料，請先至「訂單」頁面同步 Patisco。
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* PI selector */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">選擇 PI</label>
          <select
            value={selectedPiId}
            onChange={(e) => handlePiChange(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
          >
            {piList.map((pi) => (
              <option key={pi.piId} value={pi.piId}>
                {pi.piNo} — {pi.buyerName} ({pi.countryCode}) · {pi.products.length} 項產品
              </option>
            ))}
          </select>
          {selectedPI && (
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              買家：{selectedPI.buyerName} &nbsp;·&nbsp; {countryLabel(selectedPI.countryCode)}
            </p>
          )}
        </div>

        {/* Products in this PI */}
        {selectedPI && selectedPI.products.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">選擇要生成文案的產品</span>
              <button
                onClick={() =>
                  selectedSkus.size === selectedPI.products.length
                    ? setSelectedSkus(new Set())
                    : setSelectedSkus(new Set(selectedPI.products.map((p) => p.sku)))
                }
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {selectedSkus.size === selectedPI.products.length ? '全部取消' : '全選'}
              </button>
            </div>
            <div className="space-y-2">
              {selectedPI.products.map((p) => (
                <label key={p.sku} className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedSkus.has(p.sku)}
                    onChange={() => toggleSku(p.sku)}
                    className="mt-0.5 accent-gray-900"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">
                    {p.specification}
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{p.sku}{p.unit ? ` · ${p.unit}` : ''}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Prompt + generate */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-5">
        <div className="flex gap-3 items-center">
          <div className="w-48">
            <label className="block text-xs text-gray-500 mb-1">發佈管道</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white"
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <PromptEditor
          platform={channel === 'instagram' || channel === 'facebook' ? 'meta_feed' : channel === 'google' ? 'google_search' : 'general'}
          value={userPrompt}
          onChange={setUserPrompt}
        />

        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={generating || selectedSkus.size === 0}
            className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating
              ? `生成中 ${results.length}/${selectedSkus.size}…`
              : `生成 ${selectedSkus.size} 項文案`}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Results — one section per product */}
      {results.map((r) => (
        <div key={r.sku}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {r.specification}
            <span className="ml-2 font-normal text-gray-400 dark:text-gray-500 text-xs">{r.sku}</span>
          </h3>
          {r.error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded">
              {r.error}
            </div>
          ) : r.versions.length === 0 ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 animate-pulse">
                  <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/4 mb-3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {r.versions.map((v) => (
                <CopyCard key={v.version} {...v} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
