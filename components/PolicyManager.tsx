'use client'

import { useState, useEffect } from 'react'

interface Policy {
  product_category: string
  is_wear_item: boolean
  defect_lifetime: boolean
  defect_years: number | null
  defect_requires_original_owner: boolean
  defect_subsequent_owner_years: number | null
  crash_discount_pct: number | null
  crash_free_years: string
  crash_requires_original_owner: boolean
  labor_included: boolean
  claim_channel: string | null
  notes: string | null
}

const EMPTY: Omit<Policy, 'crash_free_years'> & { crash_free_years: string } = {
  product_category: '',
  is_wear_item: false,
  defect_lifetime: true,
  defect_years: null,
  defect_requires_original_owner: true,
  defect_subsequent_owner_years: null,
  crash_discount_pct: null,
  crash_free_years: '0',
  crash_requires_original_owner: true,
  labor_included: false,
  claim_channel: '',
  notes: '',
}

export default function PolicyManager() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/repair/policies')
    const data = await res.json()
    setPolicies(data.policies ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  function edit(p: Policy) {
    setForm({ ...p, crash_free_years: String(p.crash_free_years), claim_channel: p.claim_channel ?? '', notes: p.notes ?? '' })
  }

  async function save() {
    if (!form.product_category.trim()) {
      setError('請填寫品類')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/repair/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCategory: form.product_category.trim(),
          isWearItem: form.is_wear_item,
          defectLifetime: form.defect_lifetime,
          defectYears: form.defect_years,
          defectRequiresOriginalOwner: form.defect_requires_original_owner,
          defectSubsequentOwnerYears: form.defect_subsequent_owner_years,
          crashDiscountPct: form.crash_discount_pct,
          crashFreeYears: parseFloat(form.crash_free_years || '0'),
          crashRequiresOriginalOwner: form.crash_requires_original_owner,
          laborIncluded: form.labor_included,
          claimChannel: form.claim_channel,
          notes: form.notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '儲存失敗')
      setForm(EMPTY)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            className="border border-gray-200 rounded-md px-3 py-2 text-sm"
            placeholder="品類，例如：frame / rim / component"
            value={form.product_category}
            onChange={(e) => setForm({ ...form, product_category: e.target.value })}
          />
          <input
            className="border border-gray-200 rounded-md px-3 py-2 text-sm"
            placeholder="送件審核管道，例如：authorized_dealer（留空＝可自行認定）"
            value={form.claim_channel ?? ''}
            onChange={(e) => setForm({ ...form, claim_channel: e.target.value })}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.is_wear_item} onChange={(e) => setForm({ ...form, is_wear_item: e.target.checked })} />
          正常磨損件（不論年限一律不理賠，其餘欄位失效）
        </label>

        {!form.is_wear_item && (
          <>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">瑕疵保固（defect）</p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.defect_lifetime} onChange={(e) => setForm({ ...form, defect_lifetime: e.target.checked })} />
                  終身保固
                </label>
                {!form.defect_lifetime && (
                  <input
                    type="number"
                    className="w-24 border border-gray-200 rounded-md px-2 py-1 text-sm"
                    placeholder="年限"
                    value={form.defect_years ?? ''}
                    onChange={(e) => setForm({ ...form, defect_years: e.target.value ? Number(e.target.value) : null })}
                  />
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.defect_requires_original_owner}
                    onChange={(e) => setForm({ ...form, defect_requires_original_owner: e.target.checked })}
                  />
                  限原始買家
                </label>
                <span className="text-gray-400">非原始買家年限（從製造日起算）：</span>
                <input
                  type="number"
                  className="w-24 border border-gray-200 rounded-md px-2 py-1 text-sm"
                  placeholder="留空＝不適用"
                  value={form.defect_subsequent_owner_years ?? ''}
                  onChange={(e) => setForm({ ...form, defect_subsequent_owner_years: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">墜車折扣重購（crash replacement）</p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-400">免費年限：</span>
                <input
                  type="number"
                  step="0.1"
                  className="w-20 border border-gray-200 rounded-md px-2 py-1 text-sm"
                  value={form.crash_free_years}
                  onChange={(e) => setForm({ ...form, crash_free_years: e.target.value })}
                />
                <span className="text-gray-400">之後折扣％（30＝七折）：</span>
                <input
                  type="number"
                  className="w-20 border border-gray-200 rounded-md px-2 py-1 text-sm"
                  placeholder="留空＝無此方案"
                  value={form.crash_discount_pct ?? ''}
                  onChange={(e) => setForm({ ...form, crash_discount_pct: e.target.value ? Number(e.target.value) : null })}
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.crash_requires_original_owner}
                    onChange={(e) => setForm({ ...form, crash_requires_original_owner: e.target.checked })}
                  />
                  限原始買家
                </label>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.labor_included} onChange={(e) => setForm({ ...form, labor_included: e.target.checked })} />
              理賠含工資（未勾選＝僅換料件，工資需自付）
            </label>
          </>
        )}

        <textarea
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
          placeholder="備註（例如排除項目、送件需求等）"
          value={form.notes ?? ''}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        {error && <div className="text-xs text-red-600">{error}</div>}
        <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white disabled:opacity-40">
          {saving ? '儲存中…' : '儲存政策'}
        </button>
      </div>

      <div className="space-y-2">
        {policies.length === 0 && <p className="text-sm text-gray-400">尚未設定任何品類的保固政策</p>}
        {policies.map((p) => (
          <button
            key={p.product_category}
            onClick={() => edit(p)}
            className="w-full text-left border border-gray-100 rounded-md px-3 py-2 text-sm hover:border-gray-300"
          >
            <div className="text-gray-900 font-medium">{p.product_category}</div>
            <div className="text-gray-500 text-xs mt-0.5">
              {p.is_wear_item
                ? '正常磨損件，不理賠'
                : `瑕疵：${p.defect_lifetime ? '終身' : `${p.defect_years} 年`}｜墜車：${
                    p.crash_discount_pct === null ? '無此方案' : `${p.crash_free_years} 年免費，之後 ${p.crash_discount_pct}% off`
                  }${p.claim_channel ? `｜需送 ${p.claim_channel}` : ''}`}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
