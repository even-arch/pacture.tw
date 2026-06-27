'use client'

import { useState, useEffect, useCallback } from 'react'
import CopyCard from './CopyCard'
import PromptEditor from './PromptEditor'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Recommendation {
  sku: string
  specification: string
  priority: 'high' | 'medium' | 'low'
  reason: string
  suggestedPlatform: 'google' | 'meta' | 'both'
  suggestedFormat: 'search' | 'display' | 'youtube' | 'feed' | 'stories' | 'reels'
  targetCountries: string[]
  adAngle: string
  proposedHeadline: string
  proposedHook: string
  placements?: string[]
  targetLanguage?: string
  keywords?: { direction: string; examples: string[]; matchType: string }
  schedule?: { bestDays: string; bestHours: string; reasoning: string }
  downstreamType?: 'b2b' | 'b2c' | 'mixed' | 'unknown'
  downstreamReasoning?: string
  geoTargeting?: string
}

interface AnalysisResult {
  id?: string
  createdAt?: string
  summary: string
  regionBreakdown: { countryCode: string; piCount: number }[]
  topProducts: { sku: string; specification: string; orderCount: number; countries: string[] }[]
  recommendations: Recommendation[]
}

interface CopyVersion {
  version: number
  tone: string
  copy: string
  fields?: Record<string, string>
}

interface GeneratedCopy {
  sku: string
  countryCode: string
  platform: string
  adFormat: string
  versions: CopyVersion[]
  error?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  high:   { label: '優先投放', dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
  medium: { label: '建議投放', dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700' },
  low:    { label: '潛力市場', dot: 'bg-gray-300',   badge: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600' },
}

const GOOGLE_FORMATS = [
  { value: 'search',  label: '關鍵字廣告', icon: '🔍', desc: 'Google Search' },
  { value: 'display', label: '展示廣告',   icon: '🖼', desc: 'Google Display' },
  { value: 'youtube', label: 'YouTube',     icon: '▶️', desc: 'YouTube Ads' },
]

const META_FORMATS = [
  { value: 'feed',    label: '動態貼文', icon: '📱', desc: 'Facebook / Instagram Feed' },
  { value: 'stories', label: '限時動態', icon: '⚡', desc: 'Stories' },
  { value: 'reels',   label: 'Reels',    icon: '🎬', desc: 'Reels / Short Video' },
]

const COUNTRY_FLAGS: Record<string, string> = {
  TW: '🇹🇼', JP: '🇯🇵', CA: '🇨🇦', US: '🇺🇸', DE: '🇩🇪',
  FR: '🇫🇷', GB: '🇬🇧', AU: '🇦🇺', KR: '🇰🇷', SG: '🇸🇬',
  HK: '🇭🇰', CN: '🇨🇳', AF: '🇦🇫',
}

const REGION_COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-pink-500',
  'bg-orange-500', 'bg-teal-500', 'bg-cyan-500', 'bg-rose-500',
]

// ─── Mini Chart Components ────────────────────────────────────────────────────

function RegionChart({ data }: { data: { countryCode: string; piCount: number }[] }) {
  const total = data.reduce((s, r) => s + r.piCount, 0)
  const top = data.slice(0, 6)

  let offset = 0
  const r = 40, cx = 50, cy = 50, stroke = 14
  const circ = 2 * Math.PI * r
  const slices = top.map((item, i) => {
    const pct = item.piCount / total
    const dash = pct * circ
    const slice = { ...item, dash, offset, color: REGION_COLORS[i] }
    offset += dash
    return slice
  })

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0 -rotate-90">
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            strokeWidth={stroke}
            stroke={s.color.replace('bg-', '').replace('-500', '')}
            className={s.color.replace('bg-', 'stroke-')}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </svg>
      <div className="space-y-1.5 flex-1">
        {top.map((item, i) => (
          <div key={item.countryCode} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${REGION_COLORS[i]}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400 w-6">{COUNTRY_FLAGS[item.countryCode] ?? item.countryCode}</span>
            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{item.countryCode}</span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${REGION_COLORS[i]}`}
                style={{ width: `${(item.piCount / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 w-6 text-right">{item.piCount}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductChart({ data }: { data: { sku: string; specification: string; orderCount: number }[] }) {
  const max = Math.max(...data.map((p) => p.orderCount), 1)
  return (
    <div className="space-y-2">
      {data.slice(0, 6).map((p, i) => (
        <div key={p.sku} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono w-5 text-right">{i + 1}</span>
          <span className="text-xs text-gray-600 dark:text-gray-400 w-28 truncate shrink-0">{p.sku}</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-400"
              style={{ width: `${(p.orderCount / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 w-6 text-right font-medium">{p.orderCount}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Ad Preview Mockups ───────────────────────────────────────────────────────

function GoogleSearchPreview({ headline, hook }: { headline: string; hook: string }) {
  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 text-left">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs border border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400 px-1 rounded">廣告</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">· patisco.com</span>
      </div>
      <p className="text-sm text-blue-700 dark:text-blue-400 font-medium leading-snug">{headline || '（標題預覽）'}</p>
      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">{hook || '（說明文字預覽）'}</p>
    </div>
  )
}

function MetaFeedPreview({ headline, hook }: { headline: string; hook: string }) {
  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700 text-left">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">P</div>
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-white">Point Asia</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">贊助</p>
        </div>
      </div>
      <div className="bg-gray-100 dark:bg-gray-600 h-20 flex items-center justify-center text-gray-300 dark:text-gray-500 text-xs">圖片區</div>
      <div className="px-3 py-2">
        <p className="text-xs text-gray-700 dark:text-gray-300 mb-1 line-clamp-2">{hook || '（貼文文字預覽）'}</p>
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-600 pt-2 mt-1">
          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{headline || '（標題）'}</p>
          <button className="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-300 shrink-0 ml-2">了解更多</button>
        </div>
      </div>
    </div>
  )
}

// ─── Recommendation Card ──────────────────────────────────────────────────────

function RecCard({ rec, onDelete }: { rec: Recommendation; onDelete?: () => void }) {
  const defaultPlatform: 'google' | 'meta' =
    rec.suggestedPlatform === 'both' ? 'google' : rec.suggestedPlatform

  const defaultFormat = rec.suggestedFormat

  const [platform, setPlatform] = useState<'google' | 'meta'>(defaultPlatform)
  const [adFormat, setAdFormat] = useState<'search'|'display'|'youtube'|'feed'|'stories'|'reels'>(defaultFormat as 'search'|'display'|'youtube'|'feed'|'stories'|'reels')
  const [userPrompt, setUserPrompt] = useState('')
  const [copies, setCopies] = useState<GeneratedCopy[]>([])
  const [generating, setGenerating] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)

  const promptPlatform =
    platform === 'google' && adFormat === 'search'  ? 'google_search' :
    platform === 'google' && adFormat === 'display' ? 'google_display' :
    platform === 'google' && adFormat === 'youtube' ? 'video' :
    platform === 'meta'   && adFormat === 'feed'    ? 'meta_feed' :
    platform === 'meta' ? 'meta_stories' : 'general'

  const formats = platform === 'google' ? GOOGLE_FORMATS : META_FORMATS

  const handlePlatformChange = (p: 'google' | 'meta') => {
    setPlatform(p)
    const fmts = p === 'google' ? GOOGLE_FORMATS : META_FORMATS
    if (!fmts.find((f) => f.value === adFormat)) setAdFormat(fmts[0].value as 'search'|'display'|'youtube'|'feed'|'stories'|'reels')
  }

  async function handleGenerate() {
    setGenerating(true)
    const results: GeneratedCopy[] = []

    for (const countryCode of rec.targetCountries) {
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: rec.sku,
            specification: rec.specification,
            countryCode,
            platform,
            adFormat,
            extraNote: rec.adAngle || undefined,
            userPrompt: userPrompt || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'failed')
        results.push({ sku: rec.sku, countryCode, platform, adFormat, versions: data.versions })
      } catch (e) {
        results.push({ sku: rec.sku, countryCode, platform, adFormat, versions: [], error: e instanceof Error ? e.message : 'error' })
      }
      setCopies([...results])
    }
    setGenerating(false)
  }

  const pc = PRIORITY_CONFIG[rec.priority]

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 flex items-start gap-3">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${pc.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${pc.badge}`}>{pc.label}</span>
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{rec.sku}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{rec.targetCountries.map(c => (COUNTRY_FLAGS[c] ?? '') + c).join(' ')}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{rec.specification}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{rec.reason}</p>
          {rec.downstreamType && rec.downstreamType !== 'unknown' && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                rec.downstreamType === 'b2b'   ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700' :
                rec.downstreamType === 'b2c'   ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' :
                                                 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700'
              }`}>
                下游：{rec.downstreamType === 'b2b' ? 'B2B' : rec.downstreamType === 'b2c' ? 'B2C' : 'B2B + B2C'}
              </span>
              {rec.downstreamReasoning && (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">{rec.downstreamReasoning}</span>
              )}
            </div>
          )}
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-gray-200 dark:text-gray-600 hover:text-red-400 transition-colors text-lg leading-none shrink-0 mt-0.5"
            title="移除這則建議"
          >
            ×
          </button>
        )}
      </div>

      {/* Ad direction preview */}
      <div className="px-5 pb-4">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">廣告方向預覽</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">Google 搜尋</p>
            <GoogleSearchPreview headline={rec.proposedHeadline} hook={rec.proposedHook} />
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">Meta 動態</p>
            <MetaFeedPreview headline={rec.proposedHeadline} hook={rec.proposedHook} />
          </div>
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400 italic mt-2">切入角度：{rec.adAngle}</p>
      </div>

      {/* Ad planning details */}
      {(rec.placements || rec.targetLanguage || rec.keywords || rec.schedule) && (
        <div className="px-5 pb-5 grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-700 pt-4">

          {(rec.placements || rec.targetLanguage) && (
            <div className="space-y-3">
              {rec.placements && rec.placements.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">投放版位</p>
                  <ul className="space-y-1">
                    {rec.placements.map((p, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <span className="text-gray-300 dark:text-gray-600 mt-0.5">▸</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {rec.targetLanguage && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">主要語言</p>
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">{rec.targetLanguage}</span>
                </div>
              )}
            </div>
          )}

          {rec.keywords && (
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">關鍵字策略</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{rec.keywords.direction}</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {rec.keywords.examples.map((kw, i) => (
                  <span key={i} className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-700 px-2 py-0.5 rounded">
                    {kw}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">{rec.keywords.matchType}</p>
            </div>
          )}

          {rec.schedule && (
            <div className="col-span-2 bg-gray-50 dark:bg-gray-750 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">建議投放時段</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">星期</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">{rec.schedule.bestDays}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">時段</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">{rec.schedule.bestHours}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2">{rec.schedule.reasoning}</p>
            </div>
          )}

          {rec.geoTargeting && (
            <div className="col-span-2 flex items-start gap-2">
              <span className="text-gray-300 dark:text-gray-600 text-sm mt-0.5">📍</span>
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">地理定向</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{rec.geoTargeting}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Platform + format selector */}
      <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => handlePlatformChange('google')}
            className={`flex-1 py-1.5 text-xs rounded font-medium border transition-colors ${
              platform === 'google'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-400'
            }`}
          >
            🔵 Google Ads
          </button>
          <button
            onClick={() => handlePlatformChange('meta')}
            className={`flex-1 py-1.5 text-xs rounded font-medium border transition-colors ${
              platform === 'meta'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-400'
            }`}
          >
            🔵 Meta Ads
          </button>
        </div>

        <div className="flex gap-2">
          {formats.map((f) => (
            <button
              key={f.value}
              onClick={() => setAdFormat(f.value as 'search'|'display'|'youtube'|'feed'|'stories'|'reels')}
              className={`flex-1 py-1.5 px-2 text-xs rounded border transition-colors ${
                adFormat === f.value
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-400'
              }`}
            >
              <span className="mr-1">{f.icon}</span>{f.label}
            </button>
          ))}
        </div>

        {/* Prompt editor — collapsed by default */}
        <div>
          <button
            type="button"
            onClick={() => setPromptOpen((v) => !v)}
            className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center gap-1"
          >
            <span className={`inline-block transition-transform ${promptOpen ? 'rotate-90' : ''}`}>▶</span>
            {promptOpen ? '收起 Prompt' : '查看 / 編輯 Prompt'}
          </button>
          {promptOpen && (
            <div className="mt-3">
              <PromptEditor
                platform={promptPlatform}
                value={userPrompt}
                onChange={setUserPrompt}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {generating
              ? `生成中 ${copies.length}/${rec.targetCountries.length}…`
              : copies.length > 0 ? '重新生成' : '立即生成'}
          </button>
        </div>
      </div>

      {/* Results */}
      {(generating || copies.length > 0) && (
        <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
          {copies.map((gc) => (
            <div key={`${gc.countryCode}-${gc.adFormat}`} className="px-5 py-4">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-3 uppercase">
                {COUNTRY_FLAGS[gc.countryCode] ?? ''} {gc.countryCode}
              </p>
              {gc.error ? (
                <p className="text-xs text-red-600 dark:text-red-400">{gc.error}</p>
              ) : gc.versions.length === 0 ? (
                <div className="space-y-2 animate-pulse">
                  {[1,2,3].map((i) => <div key={i} className="h-3 bg-gray-100 dark:bg-gray-700 rounded" />)}
                </div>
              ) : (
                <div className="grid gap-3">
                  {gc.versions.map((v) => (
                    <CopyCard key={v.version} {...v} platform={gc.platform} adFormat={gc.adFormat} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {generating && rec.targetCountries.slice(copies.length).map((cc) => (
            <div key={cc} className="px-5 py-4">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-3 uppercase">{COUNTRY_FLAGS[cc] ?? ''} {cc}</p>
              <div className="space-y-2 animate-pulse">
                {[1,2,3].map((i) => <div key={i} className="h-3 bg-gray-100 dark:bg-gray-700 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function InsightsPanel() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isEmpty, setIsEmpty] = useState(false)
  const [hasHidden, setHasHidden] = useState(false)

  const fetchAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    setIsEmpty(false)
    try {
      const res = await fetch('/api/analysis')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      if (data.empty) {
        setIsEmpty(true)
        setHasHidden(data.hasHidden ?? false)
        return
      }
      setAnalysis(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analysis', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      setAnalysis(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAnalysis() }, [fetchAnalysis])

  async function handleUnhide() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analysis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unhide' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'failed')
      setIsEmpty(false)
      setAnalysis(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 animate-pulse">
          <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/3 mb-4" />
          <div className="grid grid-cols-2 gap-6">
            <div className="h-28 bg-gray-50 dark:bg-gray-700 rounded-lg" />
            <div className="h-28 bg-gray-50 dark:bg-gray-700 rounded-lg" />
          </div>
        </div>
        {[1,2,3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 h-48 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded flex items-center justify-between">
        <span>{error}</span>
        <button onClick={fetchAnalysis} className="underline ml-4">重試</button>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">目前沒有顯示中的分析記錄</p>
        <div className="flex justify-center gap-3">
          {hasHidden && (
            <button
              onClick={handleUnhide}
              className="text-sm px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              顯示上一份分析
            </button>
          )}
          <button
            onClick={runAnalysis}
            className="text-sm px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
          >
            重新分析
          </button>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="space-y-6">

      {/* Stats overview */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">市場概覽</p>
        <div className="grid grid-cols-2 gap-8 mb-5">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">地區分佈</p>
            <RegionChart data={analysis.regionBreakdown} />
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">熱銷商品（訂單數）</p>
            <ProductChart data={analysis.topProducts} />
          </div>
        </div>
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">AI 分析</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.summary}</p>
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">投放建議</h2>
            {analysis.createdAt && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                分析時間：{new Date(analysis.createdAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (!analysis.id) return
                await fetch('/api/analysis', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: analysis.id }) })
                setAnalysis(null)
              }}
              className="text-xs text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
              title="隱藏這份分析（資料仍保留，不會刪除）"
            >
              隱藏
            </button>
            <button onClick={runAnalysis} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">重新分析</button>
          </div>
        </div>
        <div className="space-y-4">
          {analysis.recommendations.map((rec, i) => (
            <RecCard
              key={`${rec.sku}-${i}`}
              rec={rec}
              onDelete={async () => {
                if (!analysis.id) return
                await fetch('/api/analysis', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: analysis.id, index: i }),
                })
                setAnalysis((prev) => prev ? {
                  ...prev,
                  recommendations: prev.recommendations.filter((_, j) => j !== i),
                } : prev)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
