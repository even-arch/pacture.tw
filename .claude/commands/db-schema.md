# DB Schema — Pacture.tw

## 資料庫技術
- **Neon PostgreSQL**（serverless）
- 套件：`@neondatabase/serverless`
- 連線字串：`DATABASE_URL` env var

## 初始化模式（重要）
`lib/db.ts` 使用 lazy singleton：

```ts
let _sql: NeonQueryFunction | null = null
function getDb() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!)
  return _sql
}
export const sql = ((strings, ...values) => getDb()(strings, ...values)) as NeonQueryFunction
```

- 不要在模組頂層呼叫 `neon()`，會在 build time 找不到 env var 而報錯
- 所有 DB 操作的 page 或 route 必須加 `export const dynamic = 'force-dynamic'`，否則 Next.js 會在 build time 靜態化並崩潰

## 核心 Table 一覽

### `users`
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID PK | 自動產生 |
| email | TEXT UNIQUE | 登入帳號 |
| password_hash | TEXT | bcryptjs hash |
| role | TEXT | `'admin'` / `'user'`，預設 `'user'` |
| status | TEXT | `'active'` / `'suspended'` / `'pending'`，預設 `'active'` |
| service_tier | TEXT | `'self'` / `'managed'`，預設 `'self'` |
| patisco_jwt | TEXT | Patisco 登入 JWT |
| patisco_api_key | TEXT | Patisco API Key |
| anthropic_api_key | TEXT | 用戶自己的 Anthropic key |
| openai_api_key | TEXT | 用戶自己的 OpenAI key |
| firecrawl_api_key | TEXT | 用戶自己的 Firecrawl key |
| google_ads_developer_token | TEXT | 自助用戶填自己的 dev token |
| google_ads_customer_id | TEXT | Google Ads 帳戶 ID（格式 xxx-xxx-xxxx） |
| meta_access_token | TEXT | Meta OAuth 長效 token（60 天） |
| meta_ad_account_id | TEXT | Meta 廣告帳號 ID（帶 `act_` 前綴） |
| preferred_copy_model | TEXT | `'anthropic'` / `'openai'` |
| preferred_embedding_provider | TEXT | `'openai'` / `'anthropic'` |
| created_at | TIMESTAMPTZ | |

### `admin_keys`
全域共用 key，不屬於任何 user。

| 欄位 | 說明 |
|------|------|
| id | SERIAL PK |
| key_name | TEXT UNIQUE（見下方清單） |
| key_value | TEXT |
| updated_at | TIMESTAMPTZ |

有效的 `key_name`：
- `anthropic_api_key`
- `openai_api_key`
- `firecrawl_api_key`
- `google_ads_developer_token`
- `google_ads_manager_customer_id`
- `meta_app_id`
- `meta_app_secret`
- `meta_system_user_token`

### `proforma_invoices`
Patisco 同步的 PI 資料，**永遠以 `user_id` 隔離**。

| 欄位 | 說明 |
|------|------|
| id | UUID PK |
| user_id | FK → users.id |
| pi_id | Patisco 內部 ID |
| pi_no | PI 單號（人類可讀） |
| po_id / po_no | 對應的 PO |
| product_categories | TEXT[] — SKU 陣列 |
| customer_region | 買方國家代碼 |
| status | `confirmed` / `archived` / `pending` / `draft` |
| raw_data | JSONB — 完整 PI detail（含 buyer, products, shippingInfo） |
| synced_at | TIMESTAMPTZ |

UNIQUE constraint：`(user_id, pi_id)`
→ UPSERT 用 `ON CONFLICT (user_id, pi_id) DO UPDATE SET ...`

### `copy_drafts`
生成的廣告文案，**以 `user_id` 隔離**。

| 欄位 | 說明 |
|------|------|
| id | UUID PK |
| user_id | FK |
| sku | TEXT |
| specification | TEXT |
| country_code | TEXT |
| platform | `google` / `meta` |
| ad_format | `search` / `display` / `youtube` / `feed` / `stories` / `reels` |
| extra_note | TEXT nullable |
| versions | JSONB — `CopyVersion[]` |
| is_published | BOOLEAN 預設 FALSE |
| created_at | TIMESTAMPTZ |

### `analysis_results`
AI 市場分析結果，**以 `user_id` 隔離**。

| 欄位 | 說明 |
|------|------|
| id | UUID PK |
| user_id | FK |
| summary | TEXT |
| region_breakdown | JSONB |
| top_products | JSONB |
| recommendations | JSONB — `Recommendation[]` |
| is_hidden | BOOLEAN 預設 FALSE |
| created_at | TIMESTAMPTZ |

刪除單一推薦：`recommendations = recommendations - ${index}`（PostgreSQL JSONB array operator）

### `prompt_templates`
Admin 建立的全域模板，所有用戶共享（無 user_id 隔離）。

| 欄位 | 說明 |
|------|------|
| id | SERIAL PK |
| name | TEXT |
| platform | `general` / `google_search` / `google_display` / `meta_feed` / `meta_stories` / `video` |
| content | TEXT — Prompt 內容 |
| is_default | BOOLEAN |
| sort_order | INT |

### `access_requests`
公開申請頁 `/request-access` 寫入，UNIQUE constraint 防止重複送出。

## Migration 方式
- 用 `scripts/migrate.mjs` 或 `scripts/migrate-admin.mjs` 手動執行
- 格式：`await sql\`ALTER TABLE ...\``
- 沒有自動 migration runner，部署前需手動跑

## 常見地雷
1. JSONB 欄位傳入時需 cast：`${JSON.stringify(data) as unknown as never}`
2. `raw_data->'buyer'->>'countryCode'` 是標準 JSONB 路徑語法，注意 `->` 取物件、`->>` 取字串
3. Neon serverless 在冷啟動時有延遲，第一個 request 可能慢 1-2 秒
4. 不支援 `LISTEN/NOTIFY` 或 persistent connection
