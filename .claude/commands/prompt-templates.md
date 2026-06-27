# Prompt Template 系統 — Pacture.tw

## 設計目的

讓 Admin 預先寫好廣告文案的 Prompt 建議稿，用戶生成文案前可以看到、修改，再送出。
好處：提高生成品質、降低用戶門檻、減少平台責任（用戶親自確認 Prompt）。

## 資料層（`prompt_templates` table）

| 欄位 | 說明 |
|------|------|
| id | SERIAL PK |
| name | 模板名稱（給 Admin 管理用，用戶在下拉選單看到） |
| platform | 平台類型（見下方清單） |
| content | Prompt 內容（純文字） |
| is_default | TRUE 表示進頁面時自動預填 |
| sort_order | 排序（數字小的排前面） |

## Platform 值與對應場景

| platform 值 | 適用場景 |
|------------|---------|
| `general` | 通用（所有未指定平台的情況） |
| `google_search` | Google 關鍵字廣告 |
| `google_display` | Google 展示廣告 |
| `meta_feed` | Facebook / Instagram 動態 |
| `meta_stories` | Meta Stories / Reels |
| `video` | YouTube 或影片腳本 |

## API

### 用戶端（只有 GET）
`GET /api/prompts?platform={platform}` → 回傳該平台的模板清單（按 sort_order 排序）

### Admin 端（完整 CRUD）
- `GET /api/admin/prompts` → 所有模板
- `POST /api/admin/prompts` → 新增（body: `{ name, platform, content, isDefault, sortOrder }`）
- `PUT /api/admin/prompts` → 更新（body 同上，加 `id`）
- `DELETE /api/admin/prompts?id={id}` → 刪除

## 前端元件：`PromptEditor`（`components/PromptEditor.tsx`）

Props：
```ts
{
  platform?: string   // 決定載入哪個平台的模板
  value: string       // 目前的 prompt 內容（controlled）
  onChange: (val: string) => void
}
```

行為：
1. mount 時自動呼叫 `GET /api/prompts?platform={platform}`
2. 若 `value` 為空且有 `is_default = true` 的模板，自動預填
3. 顯示「套用模板 ▾」下拉，讓用戶切換其他模板
4. `<textarea>` 可直接編輯（font-mono，resizable）

**地雷**：`value` 是 controlled input，父元件必須用 `useState` 管理，並傳入 `onChange`。
不要讓 `PromptEditor` 管理自己的 state，否則父元件拿不到最新值。

## PromptEditor 的使用位置

### 1. `InsightsPanel.tsx`（RecCard）
- 預設收起（`promptOpen` state，點「查看/編輯 Prompt」才展開）
- platform 由 `platform + adFormat` 組合決定：
  ```ts
  const promptPlatform =
    platform === 'google' && adFormat === 'search'  ? 'google_search' :
    platform === 'google' && adFormat === 'display' ? 'google_display' :
    platform === 'google' && adFormat === 'youtube' ? 'video' :
    platform === 'meta'   && adFormat === 'feed'    ? 'meta_feed' :
    platform === 'meta' ? 'meta_stories' : 'general'
  ```

### 2. `CopyGenerator.tsx`
- 預設展開（不收起）
- platform mapping：
  ```ts
  channel === 'instagram' || channel === 'facebook' ? 'meta_feed' :
  channel === 'google' ? 'google_search' : 'general'
  ```

## `userPrompt` 傳遞路徑

```
PromptEditor.onChange → 父元件 useState(userPrompt)
→ POST /api/generate body: { ..., userPrompt }
→ lib/claude.ts generateCopy(input.userPrompt)
→ 注入到 Claude prompt
```

## Admin 後台的模板管理

位置：`/admin/dashboard` → 「Prompt 模板」tab

功能：
- 新增模板（+ 新增模板按鈕）
- 展開 inline 表單編輯（不跳頁）
- 設定 is_default（勾選框）
- 刪除（有 confirm dialog）

**注意**：is_default 沒有唯一性約束，同一個 platform 可以有多個 is_default=true 的模板。
`PromptEditor` 用 `templates.find(t => t.is_default)` 只取第一個，所以實際上只有排序最前的那個會生效。
建議 Admin 只對每個 platform 設一個 is_default。

## 預設模板清單（初始 seed）

由 `scripts/migrate-admin.mjs` seed 的四筆：

| 名稱 | Platform | is_default |
|------|---------|------------|
| 標準外銷廣告基底 | general | ✓ |
| Google Search 關鍵字廣告 | google_search | ✓ |
| Meta Feed 廣告 | meta_feed | ✓ |
| Meta Reels / YouTube 影片腳本 | video | ✓ |
