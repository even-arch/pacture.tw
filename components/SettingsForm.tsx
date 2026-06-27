'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KeyInfo { masked: string | null; set: boolean }
interface PlainInfo { value: string; set: boolean }

interface Settings {
  patiscoJwt:     KeyInfo
  patiscoApiKey:  KeyInfo
  anthropicKey:   KeyInfo
  openaiKey:      KeyInfo
  firecrawlKey:   KeyInfo
  googleAdsToken: KeyInfo
  googleCustomerId: PlainInfo
  metaToken:      KeyInfo
  metaAccountId:  PlainInfo
  preferredCopyModel: string
  preferredEmbeddingProvider: string
  serviceTier: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function saveField(field: string, value: string | null) {
  await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [field]: value }),
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ set }: { set: boolean }) {
  return set ? (
    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />已連結
    </span>
  ) : (
    <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded-full">未設定</span>
  )
}

function KeyRow({
  label, fieldKey, placeholder, masked, set, onReload,
  children,
}: {
  label: string
  fieldKey: string
  placeholder: string
  masked: string | null
  set: boolean
  onReload: () => void
  children?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!val.trim()) return
    setBusy(true)
    await saveField(fieldKey, val.trim())
    setBusy(false); setVal(''); setEditing(false); onReload()
  }
  async function clear() {
    if (!confirm(`確定移除「${label}」？`)) return
    setBusy(true)
    await saveField(fieldKey, '')
    setBusy(false); onReload()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        <StatusBadge set={set} />
      </div>
      {children}
      {set && !editing ? (
        <div className="flex items-center gap-2">
          <code className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 px-2 py-1 rounded flex-1 truncate">{masked}</code>
          <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 shrink-0">更換</button>
          <button onClick={clear} disabled={busy} className="text-xs text-red-400 hover:text-red-600 shrink-0">移除</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="password"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder={placeholder}
            className="flex-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-3 py-1.5 text-xs font-mono placeholder-gray-300 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-400"
          />
          <button onClick={save} disabled={busy || !val.trim()} className="px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-40 shrink-0">
            {busy ? '儲存…' : '儲存'}
          </button>
          {editing && <button onClick={() => { setEditing(false); setVal('') }} className="text-xs text-gray-400 dark:text-gray-500 px-2">取消</button>}
        </div>
      )}
    </div>
  )
}

function PlainRow({
  label, fieldKey, value: initVal, placeholder, set, onReload,
}: {
  label: string; fieldKey: string; value: string
  placeholder: string; set: boolean; onReload: () => void
}) {
  const [val, setVal] = useState(initVal)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setBusy(true)
    await saveField(fieldKey, val)
    setBusy(false); setSaved(true); setTimeout(() => setSaved(false), 2000); onReload()
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        <StatusBadge set={set} />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder={placeholder}
          className="flex-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-3 py-1.5 text-xs font-mono placeholder-gray-300 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-400"
        />
        <button onClick={save} disabled={busy || val === initVal} className="px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-40 shrink-0">
          {busy ? '儲存…' : saved ? '已儲存' : '儲存'}
        </button>
      </div>
    </div>
  )
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex items-center gap-2">
        <span>{icon}</span>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
      </div>
      <div className="px-5 py-4 space-y-5">{children}</div>
    </div>
  )
}

function PatiscoSyncButton() {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<string | null>(null)

  async function handleSync() {
    setStatus('syncing')
    setResult(null)
    try {
      const res = await fetch('/api/patisco/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      setResult(`同步完成：${data.synced} 筆 PI，失敗 ${data.failed} 筆`)
      setStatus('done')
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'error')
      setStatus('error')
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleSync}
        disabled={status === 'syncing'}
        className="text-sm px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
      >
        {status === 'syncing' ? '同步中…' : '立即同步 PI 資料'}
      </button>
      {result && (
        <p className={`text-xs mt-2 ${status === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{result}</p>
      )}
    </div>
  )
}

function UsageTag({ text }: { text: string }) {
  return <span className="inline-block text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-700 px-2 py-0.5 rounded mr-1 mb-1">{text}</span>
}

function DocsLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 hover:underline">
      {label} →
    </a>
  )
}

function Divider() {
  return <div className="border-t border-gray-100 dark:border-gray-700" />
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsForm() {
  const [s, setS] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [metaNotice, setMetaNotice] = useState<'connected' | 'error' | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load() {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setS(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const params = new URLSearchParams(window.location.search)
    if (params.get('meta_connected')) {
      setMetaNotice('connected')
      noticeTimer.current = setTimeout(() => setMetaNotice(null), 5000)
      window.history.replaceState({}, '', '/dashboard/settings')
    } else if (params.get('meta_error')) {
      setMetaNotice('error')
      noticeTimer.current = setTimeout(() => setMetaNotice(null), 5000)
      window.history.replaceState({}, '', '/dashboard/settings')
    }
    return () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }
  }, [])

  async function setPref(field: string, val: string) {
    await saveField(field, val)
    await load()
  }

  if (loading) return <div className="space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl animate-pulse" />)}</div>
  if (!s) return null

  const isManaged = s.serviceTier === 'managed'
  const bothAI = s.anthropicKey.set && s.openaiKey.set
  const bothEmbed = s.anthropicKey.set && s.openaiKey.set

  return (
    <div className="max-w-2xl space-y-5">

      {metaNotice === 'connected' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
          <p className="text-xs text-green-700 dark:text-green-300">Facebook 廣告帳號已成功連結！</p>
        </div>
      )}
      {metaNotice === 'error' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <p className="text-xs text-red-700 dark:text-red-300">Facebook 授權失敗，請再試一次。</p>
        </div>
      )}

      {isManaged && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3">
          <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
            你的帳號為<strong>代管模式</strong>，AI 運算由平台提供，無需設定 API Key。
            只需維持 Patisco 憑證正確，即可使用所有功能。
          </p>
        </div>
      )}

      {/* Patisco 連結 */}
      <SectionCard title="Patisco 連結" icon="🔗">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">連結你的 Patisco 帳號以同步 PI 訂單資料，作為廣告分析的基礎。</p>
        </div>
        <KeyRow
          label="JWT Token"
          fieldKey="patiscoJwt"
          placeholder="eyJ..."
          masked={s.patiscoJwt.masked}
          set={s.patiscoJwt.set}
          onReload={load}
        />
        <KeyRow
          label="API Key"
          fieldKey="patiscoApiKey"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          masked={s.patiscoApiKey.masked}
          set={s.patiscoApiKey.set}
          onReload={load}
        />
        {s.patiscoJwt.set && s.patiscoApiKey.set && (
          <PatiscoSyncButton />
        )}
      </SectionCard>

      {/* AI / 爬蟲 — 代管用戶隱藏 */}
      {!isManaged && <>
      <SectionCard title="AI 文案生成" icon="✍️">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">用於：市場分析、廣告建議生成、各平台文案撰寫</p>
          <div className="flex flex-wrap gap-1 mb-3">
            <UsageTag text="市場分析" />
            <UsageTag text="Google Ads 文案" />
            <UsageTag text="Meta Ads 文案" />
            <UsageTag text="投放建議" />
          </div>
        </div>

        <KeyRow label="Anthropic Claude" fieldKey="anthropicKey"
          placeholder="sk-ant-api03-…" masked={s.anthropicKey.masked} set={s.anthropicKey.set} onReload={load}>
          <p className="text-xs text-gray-400 dark:text-gray-500">模型：claude-opus-4-8｜擅長長篇創意文案與策略分析</p>
          <DocsLink href="https://console.anthropic.com/settings/keys" label="申請 Anthropic API Key" />
        </KeyRow>

        <Divider />

        <KeyRow label="OpenAI GPT-4" fieldKey="openaiKey"
          placeholder="sk-proj-…" masked={s.openaiKey.masked} set={s.openaiKey.set} onReload={load}>
          <p className="text-xs text-gray-400 dark:text-gray-500">模型：gpt-4o｜可作為 Claude 的備援文案引擎</p>
          <DocsLink href="https://platform.openai.com/api-keys" label="申請 OpenAI API Key" />
        </KeyRow>

        {bothAI && (
          <>
            <Divider />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">你已連結兩個 AI 服務，選擇主要文案引擎：</p>
              <div className="flex gap-2">
                {['anthropic', 'openai'].map(m => (
                  <button key={m} onClick={() => setPref('preferredCopyModel', m)}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${s.preferredCopyModel === m ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-400'}`}>
                    {m === 'anthropic' ? 'Anthropic Claude（預設）' : 'OpenAI GPT-4'}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </SectionCard>

      {/* 知識庫向量化 */}
      <SectionCard title="知識庫向量化" icon="🧠">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">用於：將爬取的產品知識文章轉換為向量，供文案生成時參考（RAG）</p>
          <div className="flex flex-wrap gap-1 mb-3">
            <UsageTag text="知識庫建立" />
            <UsageTag text="語意搜尋" />
            <UsageTag text="文案參考資料" />
          </div>
        </div>

        <KeyRow label="OpenAI Embeddings" fieldKey="openaiKey"
          placeholder="sk-proj-…" masked={s.openaiKey.masked} set={s.openaiKey.set} onReload={load}>
          <p className="text-xs text-gray-400 dark:text-gray-500">模型：text-embedding-ada-002｜1536 維向量，存入 PostgreSQL pgvector</p>
          <DocsLink href="https://platform.openai.com/api-keys" label="申請 OpenAI API Key" />
        </KeyRow>

        <Divider />

        <KeyRow label="Anthropic Voyage（備選）" fieldKey="anthropicKey"
          placeholder="sk-ant-api03-…" masked={s.anthropicKey.masked} set={s.anthropicKey.set} onReload={load}>
          <p className="text-xs text-gray-400 dark:text-gray-500">模型：voyage-3｜只需一個 Anthropic Key 即可同時支援文案生成與向量化</p>
          <DocsLink href="https://console.anthropic.com/settings/keys" label="申請 Anthropic API Key" />
        </KeyRow>

        {bothEmbed && (
          <>
            <Divider />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">選擇向量化引擎：</p>
              <div className="flex gap-2">
                {['openai', 'anthropic'].map(p => (
                  <button key={p} onClick={() => setPref('preferredEmbeddingProvider', p)}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${s.preferredEmbeddingProvider === p ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-400'}`}>
                    {p === 'openai' ? 'OpenAI（預設）' : 'Anthropic Voyage'}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </SectionCard>

      {/* 網路爬蟲 */}
      <SectionCard title="網路爬蟲" icon="🕷️">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">用於：自動爬取指定網站的產品知識、維修文章，建立文案參考知識庫</p>
          <div className="flex flex-wrap gap-1 mb-3">
            <UsageTag text="知識庫建立" />
            <UsageTag text="產品資料爬取" />
            <UsageTag text="競品分析" />
          </div>
        </div>

        <KeyRow label="Firecrawl" fieldKey="firecrawlKey"
          placeholder="fc-…" masked={s.firecrawlKey.masked} set={s.firecrawlKey.set} onReload={load}>
          <p className="text-xs text-gray-400 dark:text-gray-500">支援 JavaScript 渲染頁面的爬蟲服務，回傳乾淨的 Markdown 格式</p>
          <DocsLink href="https://www.firecrawl.dev" label="申請 Firecrawl 帳號" />
        </KeyRow>
      </SectionCard>

      </>}

      {/* 廣告平台 */}
      <SectionCard title="廣告平台" icon="📢">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">連結廣告帳號後，可直接從文案頁面預覽廣告效果，未來將支援一鍵發布</p>
          {!isManaged && (
            <div className="flex flex-wrap gap-1 mb-3">
              <UsageTag text="廣告預覽" />
              <UsageTag text="一鍵發布（即將推出）" />
              <UsageTag text="成效追蹤（即將推出）" />
            </div>
          )}
        </div>

        {/* Google Ads */}
        <div className="space-y-3 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">🔵 Google Ads</span>
          </div>
          {isManaged ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">填入你的 Google Ads 帳戶 ID，Admin 將以 Manager Account 協助代操</p>
          ) : (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">需要 Google Ads 開發者憑證與帳戶 ID，用於關鍵字廣告、展示廣告投放</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <DocsLink href="https://ads.google.com/home/" label="開設 Google Ads 帳號" />
                <DocsLink href="https://developers.google.com/google-ads/api/docs/first-call/dev-token" label="申請開發者 Token" />
              </div>
              <KeyRow label="Developer Token" fieldKey="googleAdsToken"
                placeholder="輸入 Google Ads Developer Token" masked={s.googleAdsToken.masked} set={s.googleAdsToken.set} onReload={load}>
                <></>
              </KeyRow>
            </>
          )}
          <PlainRow label="Customer ID（帳戶 ID）" fieldKey="googleCustomerId"
            value={s.googleCustomerId.value} placeholder="xxx-xxx-xxxx"
            set={s.googleCustomerId.set} onReload={load} />
        </div>

        {/* Meta — OAuth 連結 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">🔵 Meta Business（Facebook / Instagram）</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">
            {isManaged ? '連結你的 Facebook 廣告帳號，Admin 將協助代操 Feed、Stories、Reels 廣告投放' : '一鍵授權後自動取得 Access Token，用於 Feed、Stories、Reels 廣告投放'}
          </p>
          {s.metaToken.set ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />已連結 Facebook
              </span>
              <a href="/api/auth/meta"
                className="text-xs text-blue-500 dark:text-blue-400 hover:underline">
                重新授權
              </a>
              <button onClick={async () => { await saveField('metaToken', ''); await saveField('metaAccountId', ''); load() }}
                className="text-xs text-red-400 hover:text-red-600">
                解除連結
              </button>
            </div>
          ) : (
            <a href="/api/auth/meta"
              className="inline-flex items-center gap-2 bg-[#1877F2] hover:bg-[#166fe5] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              使用 Facebook 連結廣告帳號
            </a>
          )}
          {s.metaToken.set && (
            <PlainRow label="Ad Account ID" fieldKey="metaAccountId"
              value={s.metaAccountId.value} placeholder="act_xxxxxxxxxx"
              set={s.metaAccountId.set} onReload={load} />
          )}
        </div>
      </SectionCard>

      {/* Notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          所有 Key 與憑證僅儲存於你的帳號，不會用於其他用戶。
          若未設定，系統使用平台預設 Key（僅供試用，有用量限制）。
        </p>
      </div>
    </div>
  )
}
