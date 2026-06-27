# Claude 文案生成 — Pacture.tw

## 架構位置
- 核心邏輯：`lib/claude.ts` → `generateCopy(input: GenerateInput)`
- API 端點：`POST /api/generate`
- 呼叫模型：`claude-opus-4-8`（透過 `@ai-sdk/anthropic` + `generateText`）

## 六種平台/格式的 `fields` 結構

每種組合輸出的 JSON 結構**完全不同**，改動時必須對照：

### Google Search
```json
{
  "headline1": "max 30 chars",
  "headline2": "max 30 chars",
  "headline3": "max 30 chars",
  "description1": "max 90 chars",
  "description2": "max 90 chars"
}
```

### Google Display
```json
{
  "shortHeadline": "max 25 chars",
  "longHeadline": "max 90 chars",
  "description": "max 90 chars",
  "callToAction": "max 15 chars"
}
```

### YouTube / Google Video
```json
{
  "hook": "前 5 秒腳本，max 20 words",
  "body": "主訊息，30-60 words",
  "cta": "max 10 words"
}
```

### Meta Feed（Facebook / Instagram 動態）
```json
{
  "primaryText": "100-150 words，對話語氣",
  "headline": "max 40 chars",
  "description": "max 30 chars",
  "callToAction": "max 20 chars"
}
```

### Meta Stories
```json
{
  "hook": "max 10 words，開場文字",
  "body": "max 20 words",
  "cta": "max 15 chars"
}
```

### Meta Reels
```json
{
  "hook": "前 3 秒旁白或字幕，max 15 words",
  "narration": "30-50 words",
  "cta": "max 15 chars"
}
```

**注意**：所有格式都同時有 `copy`（可讀摘要）和 `fields`（結構化欄位）。
`CopyCard` 元件優先顯示 `fields`，若 fields 為空才顯示 `copy`。

## 字元計數顯示邏輯（CopyCard）

`FIELD_CHAR_LIMITS` 對照表在 `components/CopyCard.tsx`，超過上限會顯示紅色。
**如果新增平台格式，也要更新這個對照表。**

## 國家 → 語言 → 地區 Mapping

```ts
countryToLanguage: { TW/HK/MO→'zh-TW', JP→'ja', DE/AT/CH→'de', FR/BE/LU→'fr', 其他→'en' }
countryToRegion: { TW/HK/...→'Asia', JP→'Japan', US/CA/MX→'North America', ... }
```

語言名稱（用在 prompt 裡）：
```ts
{ 'zh-TW': '繁體中文', en: 'English', de: 'Deutsch', fr: 'Français', ja: '日本語' }
```

## RAG 注入

生成前會呼叫 `ragQuery('general', specification, 3)`（`lib/embeddings.ts`）：
- 查詢相關的知識庫內容（爬取過的產品文章）
- 取前 3 筆，每筆截取前 400 字
- 若無資料，context 為 `'(no reference material)'`
- 知識庫是用戶自己爬取的，所以不同用戶有不同的 RAG 結果

## User Prompt 注入

`input.userPrompt`（從 PromptEditor 傳來）注入在 format instructions **之前**：
```
${userPrompt 有值時：}
User instructions (follow these carefully):
${userPrompt}

${formatInstructions}
```

這個順序是設計決策：讓用戶指令優先於格式指令，但 Claude 會試圖同時遵守兩者。

## 回應解析（容錯設計）

Claude 有時會在 JSON 外面包 markdown code block，需要兩層容錯：

```ts
try {
  const cleaned = text.trim()
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
  return JSON.parse(cleaned)
} catch {
  const match = text.match(/\[[\s\S]*\]/)   // regex 搶救
  if (match) return JSON.parse(match[0])
  throw new Error('Failed to parse Claude response as JSON')
}
```

**如果 Claude 改了回應格式，這裡是第一個要看的地方。**

## 自動存檔

`POST /api/generate` 在成功生成後會自動 INSERT 到 `copy_drafts`：
```ts
await sql`INSERT INTO copy_drafts (user_id, sku, ..., versions) VALUES (...)`
```

不需前端另外呼叫 save API。

## API Key 來源

`generateCopy()` 接受 `anthropicApiKey` 參數，由 `getUserKeys(userId)` 提供（三層 fallback）。
詳見 `api-key-fallback` skill。

## 效能設定

```ts
export const maxDuration = 60   // 60 秒 timeout
maxOutputTokens: 2500           // 三個版本的文案夠用
```

## 三個版本的 Tone

固定輸出三個版本，tone 分別為：
- `professional`（專業型）
- `valuedriven`（價值型）
- `urgent`（急迫型）

這三個 tone 的中文標籤在 `TONE_LABELS`（`components/CopyCard.tsx`）。
