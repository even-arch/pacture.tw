'use client'

import { useState, useEffect } from 'react'

interface AdMetrics {
  platform: 'google' | 'meta'
  campaignId?: string
  sku: string
  specification: string
  adFormat: string
  countryCode: string
  impressions: number
  clicks: number
  ctr: number
  spend: number
  currency: string
  publishedAt: string
}

interface PerformanceResult {
  connected: { google: boolean; meta: boolean }
  metrics: AdMetrics[]
  lastSyncAt: string | null
}

const PLATFORM_COLORS = {
  google: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700' },
  meta:   { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-700' },
}

function ConnectCard({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">尚未連結廣告帳號，無法顯示成效數據</p>
        </div>
      </div>
      <a href="/dashboard/settings"
        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 border border-blue-200 dark:border-blue-700 px-3 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors whitespace-nowrap">
        前往設定連結 →
      </a>
    </div>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-300 dark:text-gray-600">{sub}</p>}
    </div>
  )
}

export default function PerformancePanel() {
  const [data, setData] = useState<PerformanceResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ads/performance')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="h-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl animate-pulse" />
  }

  const connected = data?.connected ?? { google: false, meta: false }
  const metrics = data?.metrics ?? []

  const totals = metrics.reduce((acc, m) => ({
    impressions: acc.impressions + m.impressions,
    clicks: acc.clicks + m.clicks,
    spend: acc.spend + m.spend,
  }), { impressions: 0, clicks: 0, spend: 0 })

  const avgCtr = totals.impressions > 0
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
    : '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">廣告成效（近 30 天）</h3>
        {data?.lastSyncAt && (
          <span className="text-xs text-gray-400">
            最後更新：{new Date(data.lastSyncAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {connected.google ? (
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Google Ads 已連結</span>
          </div>
        ) : (
          <ConnectCard label="Google Ads" icon="🔵" />
        )}
        {connected.meta ? (
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Meta Business 已連結</span>
          </div>
        ) : (
          <ConnectCard label="Meta Business" icon="🔵" />
        )}
      </div>

      {metrics.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-4">所有平台合計</p>
          <div className="grid grid-cols-4 gap-4 divide-x divide-gray-100 dark:divide-gray-700">
            <MetricCard label="曝光次數" value={totals.impressions.toLocaleString()} />
            <MetricCard label="點擊次數" value={totals.clicks.toLocaleString()} />
            <MetricCard label="平均 CTR" value={`${avgCtr}%`} />
            <MetricCard label="總花費" value={`$${totals.spend.toFixed(2)}`} sub="USD" />
          </div>
        </div>
      )}

      {metrics.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">平台</th>
                <th className="px-4 py-3 font-medium">活動名稱</th>
                <th className="px-4 py-3 font-medium text-right">曝光</th>
                <th className="px-4 py-3 font-medium text-right">點擊</th>
                <th className="px-4 py-3 font-medium text-right">CTR</th>
                <th className="px-4 py-3 font-medium text-right">花費</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => {
                const c = PLATFORM_COLORS[m.platform]
                return (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
                        {m.platform === 'google' ? 'Google' : 'Meta'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs max-w-48 truncate">{m.specification || m.campaignId}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 text-xs">{m.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 text-xs">{m.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 text-xs">
                      {m.impressions > 0 ? `${m.ctr.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 text-xs">${m.spend.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!connected.google && !connected.meta && (
        <p className="text-xs text-gray-400 text-center py-2">
          連結廣告帳號後，此處會自動顯示曝光、點擊、CTR、花費等成效數據。
        </p>
      )}
    </div>
  )
}
