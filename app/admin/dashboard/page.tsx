'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  role: string
  status: string
  service_tier: string
  created_at: string
}

const TIER_LABEL: Record<string, string> = { self: '自助', managed: '代管' }
const STATUS_LABEL: Record<string, string> = { active: '啟用', suspended: '停用', pending: '待審' }

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {text}
    </span>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'users' | 'operate' | 'prompts' | 'keys'>('users')
  const [adminKeys, setAdminKeys] = useState<Record<string, { masked: string | null; set: boolean }>>({})
  const [keyEdits, setKeyEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [opResult, setOpResult] = useState<string | null>(null)
  const [opLoading, setOpLoading] = useState(false)

  interface PromptTemplate { id: number; name: string; platform: string; content: string; is_default: boolean; sort_order: number }
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<Partial<PromptTemplate> | null>(null)
  const [promptSaving, setPromptSaving] = useState(false)

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users')
    if (res.status === 401) { router.push('/admin'); return }
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }, [router])

  const loadKeys = useCallback(async () => {
    const res = await fetch('/api/admin/keys')
    if (!res.ok) return
    setAdminKeys(await res.json())
  }, [])

  const loadTemplates = useCallback(async () => {
    const res = await fetch('/api/admin/prompts')
    if (!res.ok) return
    const data = await res.json()
    setTemplates(data.templates ?? [])
  }, [])

  useEffect(() => { loadUsers(); loadKeys(); loadTemplates() }, [loadUsers, loadKeys, loadTemplates])

  async function logout() {
    await fetch('/api/admin/login', { method: 'DELETE' })
    router.push('/admin')
  }

  async function patchUser(userId: string, action: string, extra?: object) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, ...extra }),
    })
    loadUsers()
  }

  async function deleteUser(userId: string) {
    if (!confirm('確定要刪除這個帳號？此動作無法復原。')) return
    await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE' })
    loadUsers()
  }

  async function operate(action: string) {
    if (!selectedUserId) return
    setOpLoading(true)
    setOpResult(null)
    const res = await fetch('/api/admin/operate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selectedUserId, action }),
    })
    const data = await res.json()
    if (res.ok) {
      setOpResult(`✓ 完成：同步 ${data.synced} 筆，失敗 ${data.failed} 筆（共 ${data.totalCount} 筆）`)
    } else {
      setOpResult(`✗ 錯誤：${data.error}`)
    }
    setOpLoading(false)
  }

  async function saveTemplate() {
    if (!editingTemplate) return
    setPromptSaving(true)
    if (editingTemplate.id) {
      await fetch('/api/admin/prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editingTemplate, isDefault: editingTemplate.is_default, sortOrder: editingTemplate.sort_order }) })
    } else {
      await fetch('/api/admin/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editingTemplate, isDefault: editingTemplate.is_default, sortOrder: editingTemplate.sort_order }) })
    }
    setEditingTemplate(null)
    await loadTemplates()
    setPromptSaving(false)
  }

  async function deleteTemplate(id: number) {
    if (!confirm('確定刪除此模板？')) return
    await fetch(`/api/admin/prompts?id=${id}`, { method: 'DELETE' })
    loadTemplates()
  }

  async function saveKeys() {
    setSaving(true)
    await fetch('/api/admin/keys', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keyEdits),
    })
    setKeyEdits({})
    await loadKeys()
    setSaving(false)
  }

  const regularUsers = users.filter((u) => u.role !== 'admin')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500 uppercase tracking-widest">Pacture Admin</span>
          <div className="flex gap-1">
            {(['users', 'operate', 'prompts', 'keys'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  tab === t
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {{ users: '用戶管理', operate: '代操', prompts: 'Prompt 模板', keys: '共用 API Key' }[t]}
              </button>
            ))}
          </div>
        </div>
        <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          登出
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Users Tab */}
        {tab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">用戶列表 ({regularUsers.length})</h2>
            </div>
            {loading ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">載入中...</p>
            ) : regularUsers.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">目前沒有用戶</p>
            ) : (
              <div className="space-y-2">
                {regularUsers.map((u) => (
                  <div key={u.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.email}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {new Date(u.created_at).toLocaleDateString('zh-TW')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        text={STATUS_LABEL[u.status] ?? u.status}
                        color={
                          u.status === 'active'    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' :
                          u.status === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' :
                                                     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                        }
                      />
                      <Badge
                        text={TIER_LABEL[u.service_tier] ?? u.service_tier}
                        color={u.service_tier === 'managed' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={u.service_tier}
                        onChange={(e) => patchUser(u.id, 'set_tier', { serviceTier: e.target.value })}
                        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded px-2 py-1 focus:outline-none"
                      >
                        <option value="self">自助</option>
                        <option value="managed">代管</option>
                      </select>
                      {u.status === 'active' ? (
                        <button onClick={() => patchUser(u.id, 'suspend')} className="text-xs text-yellow-600 dark:text-yellow-500 hover:text-yellow-800 dark:hover:text-yellow-400 transition-colors">
                          停用
                        </button>
                      ) : (
                        <button onClick={() => patchUser(u.id, 'activate')} className="text-xs text-green-600 dark:text-green-500 hover:text-green-800 dark:hover:text-green-400 transition-colors">
                          啟用
                        </button>
                      )}
                      <button onClick={() => deleteUser(u.id)} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors">
                        刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Operate Tab */}
        {tab === 'operate' && (
          <div>
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">代替用戶操作</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">選擇代管用戶，以 Admin 身份執行 Patisco 同步</p>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">選擇用戶</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => { setSelectedUserId(e.target.value); setOpResult(null) }}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none"
                >
                  <option value="">-- 請選擇 --</option>
                  {users.filter((u) => u.role !== 'admin').map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email} ({u.service_tier === 'managed' ? '代管' : '自助'})
                    </option>
                  ))}
                </select>
              </div>
              {selectedUserId && (
                <div className="flex gap-3">
                  <button
                    onClick={() => operate('sync')}
                    disabled={opLoading}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50 transition-colors"
                  >
                    {opLoading ? '同步中...' : '執行 Patisco 同步'}
                  </button>
                </div>
              )}
              {opResult && (
                <p className={`text-sm ${opResult.startsWith('✓') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {opResult}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Prompts Tab */}
        {tab === 'prompts' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Prompt 模板</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">生成文案時預填給用戶的建議 Prompt，用戶可自行修改後再送出</p>
              </div>
              <button
                onClick={() => setEditingTemplate({ name: '', platform: 'general', content: '', is_default: false, sort_order: templates.length + 1 })}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
              >
                + 新增模板
              </button>
            </div>

            {/* Edit form */}
            {editingTemplate && (
              <div className="bg-white dark:bg-gray-900 border border-indigo-300 dark:border-indigo-700 rounded-xl p-5 mb-6 space-y-4">
                <h3 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  {editingTemplate.id ? '編輯模板' : '新增模板'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">模板名稱</label>
                    <input
                      type="text"
                      value={editingTemplate.name ?? ''}
                      onChange={(e) => setEditingTemplate((p) => ({ ...p, name: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="例：Google Search 標準版"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">適用平台</label>
                    <select
                      value={editingTemplate.platform ?? 'general'}
                      onChange={(e) => setEditingTemplate((p) => ({ ...p, platform: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none"
                    >
                      <option value="general">通用（所有平台）</option>
                      <option value="google_search">Google Search</option>
                      <option value="google_display">Google Display</option>
                      <option value="meta_feed">Meta Feed</option>
                      <option value="meta_stories">Meta Stories / Reels</option>
                      <option value="video">影片腳本</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Prompt 內容</label>
                  <textarea
                    value={editingTemplate.content ?? ''}
                    onChange={(e) => setEditingTemplate((p) => ({ ...p, content: e.target.value }))}
                    rows={10}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-y"
                    placeholder="輸入 Prompt 內容..."
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTemplate.is_default ?? false}
                      onChange={(e) => setEditingTemplate((p) => ({ ...p, is_default: e.target.checked }))}
                      className="rounded"
                    />
                    設為預設（新用戶預填此模板）
                  </label>
                  <div className="flex items-center gap-2 ml-auto">
                    <button onClick={() => setEditingTemplate(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-3 py-1.5">取消</button>
                    <button
                      onClick={saveTemplate}
                      disabled={promptSaving || !editingTemplate.name || !editingTemplate.content}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg px-4 py-1.5 disabled:opacity-50 transition-colors"
                    >
                      {promptSaving ? '儲存中...' : '儲存'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Template list */}
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</span>
                        {t.is_default && <span className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded">預設</span>}
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 px-1.5 py-0.5 rounded">{
                          { general: '通用', google_search: 'Google Search', google_display: 'Google Display', meta_feed: 'Meta Feed', meta_stories: 'Meta Stories', video: '影片' }[t.platform] ?? t.platform
                        }</span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 whitespace-pre-wrap">{t.content}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => setEditingTemplate(t)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors">編輯</button>
                      <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors">刪除</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keys Tab */}
        {tab === 'keys' && (
          <div className="space-y-8 max-w-lg">
            {/* AI Keys */}
            <div>
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">共用 AI Key</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">代管用戶（或無自己 key 的用戶）會使用這些 key 作為後備</p>
              <div className="space-y-4">
                {[
                  { name: 'anthropic_api_key', label: 'Anthropic API Key' },
                  { name: 'openai_api_key', label: 'OpenAI API Key' },
                  { name: 'firecrawl_api_key', label: 'Firecrawl API Key' },
                ].map(({ name, label }) => (
                  <div key={name}>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={keyEdits[name] ?? ''}
                        onChange={(e) => setKeyEdits((prev) => ({ ...prev, [name]: e.target.value }))}
                        placeholder={adminKeys[name]?.masked ?? '（未設定）'}
                        className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 placeholder-gray-400 dark:placeholder-gray-600"
                      />
                      {adminKeys[name]?.set && <span className="flex items-center text-xs text-green-600 dark:text-green-400">✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Google Ads MCC */}
            <div>
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Ads Manager Account（MCC）</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                代管用戶只需提供自己的 Customer ID，Admin 以 MCC 身份代操廣告帳號
              </p>
              <div className="space-y-4">
                {[
                  { name: 'google_ads_developer_token', label: 'Developer Token', hint: '向 Google 申請的開發者憑證，所有帳號共用一組' },
                  { name: 'google_ads_manager_customer_id', label: 'Manager Customer ID（MCC ID）', hint: '你的 Google Ads Manager 帳號 ID，格式：xxx-xxx-xxxx' },
                ].map(({ name, label, hint }) => (
                  <div key={name}>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">{label}</label>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">{hint}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={keyEdits[name] ?? ''}
                        onChange={(e) => setKeyEdits((prev) => ({ ...prev, [name]: e.target.value }))}
                        placeholder={adminKeys[name]?.masked ?? '（未設定）'}
                        className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 placeholder-gray-400 dark:placeholder-gray-600"
                      />
                      {adminKeys[name]?.set && <span className="flex items-center text-xs text-green-600 dark:text-green-400">✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Meta App */}
            <div>
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meta App 憑證</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                用於 OAuth 流程與 Ads API。App ID + Secret 讓用戶可一鍵授權；System User Token 供代管用戶使用（長效不過期）
              </p>
              <div className="space-y-4">
                {[
                  { name: 'meta_app_id', label: 'App ID', hint: 'Meta for Developers → App ID' },
                  { name: 'meta_app_secret', label: 'App Secret', hint: 'Meta for Developers → App Secret' },
                  { name: 'meta_system_user_token', label: 'System User Access Token', hint: 'Meta Business Manager → System Users → 產生 Token（永久有效，用於代管用戶）' },
                ].map(({ name, label, hint }) => (
                  <div key={name}>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">{label}</label>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">{hint}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={keyEdits[name] ?? ''}
                        onChange={(e) => setKeyEdits((prev) => ({ ...prev, [name]: e.target.value }))}
                        placeholder={adminKeys[name]?.masked ?? '（未設定）'}
                        className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 placeholder-gray-400 dark:placeholder-gray-600"
                      />
                      {adminKeys[name]?.set && <span className="flex items-center text-xs text-green-600 dark:text-green-400">✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={saveKeys}
              disabled={saving || Object.keys(keyEdits).length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50 transition-colors"
            >
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
