'use client'

import { useState } from 'react'

interface CopyCardProps {
  version: number
  tone: string
  copy: string
  fields?: Record<string, string>
  platform?: string
  adFormat?: string
}

const TONE_LABELS: Record<string, string> = {
  professional: '專業型',
  valuedriven: '價值型',
  urgent: '急迫型',
  lifestyle: '生活型',
  performance: '性能型',
}

const FIELD_LABELS: Record<string, string> = {
  headline1: '標題 1', headline2: '標題 2', headline3: '標題 3',
  description1: '說明 1', description2: '說明 2',
  shortHeadline: '短標題', longHeadline: '長標題', description: '說明',
  callToAction: '行動呼籲', cta: '行動呼籲',
  hook: '開場', body: '主文', narration: '旁白',
  primaryText: '主文', headline: '標題',
}

const FIELD_CHAR_LIMITS: Record<string, number> = {
  headline1: 30, headline2: 30, headline3: 30,
  description1: 90, description2: 90,
  shortHeadline: 25, longHeadline: 90, description: 90,
  callToAction: 15, cta: 15,
  headline: 40,
}

export default function CopyCard({ version, tone, copy, fields }: CopyCardProps) {
  const [copied, setCopied] = useState(false)

  const hasFields = fields && Object.keys(fields).length > 0
  const copyText = hasFields
    ? Object.entries(fields).map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${v}`).join('\n')
    : copy

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">版本 {version}</span>
          <span className="px-2 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-full">
            {TONE_LABELS[tone] ?? tone}
          </span>
        </div>
        <button onClick={handleCopy} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          {copied ? '已複製' : '複製全部'}
        </button>
      </div>

      <div className="p-4">
        {hasFields ? (
          <div className="space-y-2.5">
            {Object.entries(fields!).map(([key, value]) => {
              const limit = FIELD_CHAR_LIMITS[key]
              const len = value?.length ?? 0
              const over = limit && len > limit
              return (
                <div key={key} className="flex gap-3">
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-16 shrink-0 pt-0.5">{FIELD_LABELS[key] ?? key}</span>
                  <div className="flex-1">
                    <p className={`text-sm leading-snug ${over ? 'text-red-600' : 'text-gray-800 dark:text-gray-200'}`}>{value}</p>
                    {limit && (
                      <span className={`text-xs mt-0.5 ${over ? 'text-red-500' : 'text-gray-300 dark:text-gray-600'}`}>
                        {len}/{limit}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{copy}</p>
        )}
      </div>
    </div>
  )
}
