import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { ragQuery } from '@/lib/embeddings'

export type AdPlatform = 'google' | 'meta'
export type AdFormat = 'search' | 'display' | 'youtube' | 'feed' | 'stories' | 'reels'

export interface GenerateInput {
  sku: string
  specification: string
  unit?: string | null
  countryCode: string
  platform: AdPlatform
  adFormat: AdFormat
  extraNote?: string
  userPrompt?: string
  anthropicApiKey?: string
}

export interface CopyVersion {
  version: number
  tone: string
  copy: string        // formatted string, structure depends on platform/format
  fields?: Record<string, string>  // structured fields (e.g. headline1, headline2, description1…)
}

function countryToLanguage(cc: string): string {
  const map: Record<string, string> = {
    TW: 'zh-TW', HK: 'zh-TW', MO: 'zh-TW',
    JP: 'ja',
    DE: 'de', AT: 'de', CH: 'de',
    FR: 'fr', BE: 'fr', LU: 'fr',
  }
  return map[cc.toUpperCase()] ?? 'en'
}

function countryToRegion(cc: string): string {
  const upper = cc.toUpperCase()
  if (['TW','HK','MO','CN','SG','MY','TH','VN','ID','PH'].includes(upper)) return 'Asia'
  if (upper === 'JP') return 'Japan'
  if (['US','CA','MX'].includes(upper)) return 'North America'
  if (['AU','NZ'].includes(upper)) return 'Australia & New Zealand'
  return 'Europe'
}

const LANGUAGE_NAMES: Record<string, string> = {
  'zh-TW': '繁體中文', en: 'English', de: 'Deutsch', fr: 'Français', ja: '日本語',
}

function buildFormatInstructions(platform: AdPlatform, adFormat: AdFormat, langLabel: string): string {
  if (platform === 'google' && adFormat === 'search') {
    return `Generate a Google Search Ad in ${langLabel}.
Each version must follow this exact JSON structure in the "fields" key:
{
  "headline1": "max 30 chars",
  "headline2": "max 30 chars",
  "headline3": "max 30 chars",
  "description1": "max 90 chars",
  "description2": "max 90 chars"
}
Also set "copy" to a readable summary of the ad.
Strictly enforce character limits. Do not use punctuation that wastes characters.`
  }
  if (platform === 'google' && adFormat === 'display') {
    return `Generate a Google Display Ad in ${langLabel}.
Each version must follow this exact JSON structure in the "fields" key:
{
  "shortHeadline": "max 25 chars",
  "longHeadline": "max 90 chars",
  "description": "max 90 chars",
  "callToAction": "max 15 chars (e.g. 立即了解, Learn More)"
}
Also set "copy" to a readable summary.`
  }
  if (platform === 'google' && adFormat === 'youtube') {
    return `Generate a YouTube video ad script hook in ${langLabel}.
Each version must follow this exact JSON structure in the "fields" key:
{
  "hook": "First 5 seconds script (max 20 words) — must grab attention immediately",
  "body": "Main message (30-60 words)",
  "cta": "Call to action (max 10 words)"
}
Also set "copy" to the full script.`
  }
  if (platform === 'meta' && adFormat === 'feed') {
    return `Generate a Meta (Facebook/Instagram) Feed Ad in ${langLabel}.
Each version must follow this exact JSON structure in the "fields" key:
{
  "primaryText": "Main post copy, 100-150 words, conversational tone",
  "headline": "Bold headline below image, max 40 chars",
  "description": "Supporting line below headline, max 30 chars",
  "callToAction": "CTA button text, max 20 chars"
}
Also set "copy" to the full ad text.`
  }
  if (platform === 'meta' && adFormat === 'stories') {
    return `Generate a Meta Stories/Reels Ad in ${langLabel}.
Each version must follow this exact JSON structure in the "fields" key:
{
  "hook": "Opening text overlay (max 10 words, punchy)",
  "body": "Supporting copy (max 20 words)",
  "cta": "Swipe-up or tap CTA (max 15 chars)"
}
Also set "copy" to the full overlay text. Keep it short — Stories are vertical and fast.`
  }
  if (platform === 'meta' && adFormat === 'reels') {
    return `Generate a Meta Reels Ad script in ${langLabel}.
Each version must follow this exact JSON structure in the "fields" key:
{
  "hook": "First 3 seconds narration or text overlay (max 15 words)",
  "narration": "Main narration (30-50 words)",
  "cta": "End screen CTA (max 15 chars)"
}
Also set "copy" to the full script.`
  }
  // fallback
  return `Generate ad copy in ${langLabel}. Set "copy" to the full ad text and leave "fields" as {}.`
}

export async function generateCopy(input: GenerateInput): Promise<CopyVersion[]> {
  const anthropic = createAnthropic({
    apiKey: input.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://api.anthropic.com/v1',
  })
  const language = countryToLanguage(input.countryCode)
  const region = countryToRegion(input.countryCode)
  const langLabel = LANGUAGE_NAMES[language] ?? 'English'
  const formatInstructions = buildFormatInstructions(input.platform, input.adFormat, langLabel)

  const ragContext = await ragQuery('general', input.specification, 3)
  const contextText = ragContext.length
    ? ragContext.map((r) => `[${r.title}]\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')
    : '(no reference material)'

  const prompt = `You are a professional digital advertising copywriter specializing in Google Ads and Meta Ads.

Product:
- SKU: ${input.sku}
- Specification: ${input.specification}
${input.unit ? `- Unit: ${input.unit}` : ''}

Target:
- Buyer region: ${region}
- Output language: ${langLabel}
- Platform: ${input.platform === 'google' ? 'Google Ads' : 'Meta Ads (Facebook/Instagram)'}
- Format: ${input.adFormat}
${input.extraNote ? `- Additional direction: ${input.extraNote}` : ''}

Background reference:
${contextText}

${input.userPrompt ? `User instructions (follow these carefully):\n${input.userPrompt}\n` : ''}
${formatInstructions}

Write exactly 3 versions with different tones. Return ONLY a raw JSON array — no markdown, no explanation:
[
  { "version": 1, "tone": "professional", "copy": "...", "fields": { ... } },
  { "version": 2, "tone": "valuedriven", "copy": "...", "fields": { ... } },
  { "version": 3, "tone": "urgent", "copy": "...", "fields": { ... } }
]`

  const { text } = await generateText({
    model: anthropic('claude-opus-4-8'),
    prompt,
    maxOutputTokens: 2500,
  })

  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(cleaned) as CopyVersion[]
  } catch {
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0]) as CopyVersion[]
    throw new Error('Failed to parse Claude response as JSON')
  }
}
