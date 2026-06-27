# API Key 三層 Fallback — Pacture.tw

## 核心邏輯（`lib/user-keys.ts`）

```ts
export async function getUserKeys(userId: string): Promise<UserKeys> {
  const [row] = await sql`SELECT anthropic_api_key, openai_api_key, firecrawl_api_key FROM users WHERE id = ${userId}`
  const admin = await getAdminKeys()   // 讀 admin_keys table

  return {
    anthropicApiKey:  row?.anthropic_api_key  || admin['anthropic_api_key']  || process.env.ANTHROPIC_API_KEY  || '',
    openaiApiKey:     row?.openai_api_key     || admin['openai_api_key']     || process.env.OPENAI_API_KEY     || '',
    firecrawlApiKey:  row?.firecrawl_api_key  || admin['firecrawl_api_key'] || process.env.FIRECRAWL_API_KEY  || '',
  }
}
```

## 三層優先順序

```
用戶自己的 key（users table）
    ↓ 若空
Admin 共用 key（admin_keys table）
    ↓ 若空
環境變數（.env）
    ↓ 若空
空字串 ''（→ API call 會失敗，前端顯示「請設定 API Key」）
```

## 哪些 Key 有 Fallback，哪些沒有

**有三層 fallback（透過 `getUserKeys`）：**
- Anthropic API Key
- OpenAI API Key
- Firecrawl API Key

**只存在 admin_keys，沒有用戶層（無 fallback 概念）：**
- `google_ads_developer_token`（MCC 的，代管才用；自助用戶存自己的在 users table）
- `google_ads_manager_customer_id`（MCC ID，全平台唯一）
- `meta_app_id`（所有 OAuth 共用）
- `meta_app_secret`（所有 OAuth 共用）
- `meta_system_user_token`（代管用戶用，不走 OAuth）

## `getUserKeys` 的使用位置

| 位置 | 用途 |
|------|------|
| `app/api/generate/route.ts` | 文案生成前取 Anthropic key |
| `app/api/analysis/route.ts` | 市場分析前取 Anthropic + Firecrawl key |

**Patisco sync 不用 `getUserKeys`**，它直接從 users table 讀 `patisco_jwt` 和 `patisco_api_key`（這兩個永遠是用戶自己的，沒有共用版本）。

## 代管用戶的 Key 策略

代管（managed）用戶：
- 不會在 UI 看到 AI key 設定欄位（`SettingsForm` 有 `isManaged` 條件）
- 但 `getUserKeys()` 會落到 admin_keys 層，因此仍然可以使用 AI 功能
- Admin 在後台填好 admin_keys 後，所有代管用戶自動使用

自助（self）用戶：
- 可以填自己的 key，優先使用
- 沒填時 fallback 到 admin_keys（試用），再到 env var

## 每次呼叫都查 DB 的效能問題

`getUserKeys()` 每次都做兩次 SQL query（users + admin_keys）。
目前資料量小不是問題，但高並發時可考慮：
- 把 admin_keys cache 在 Next.js module scope（但要注意 cold start 和 Vercel edge 的 isolation）
- 或用 Next.js `unstable_cache`

## 密鑰儲存安全注意事項

- 所有 key 明文存在 DB（沒有加密）
- `mask()` 函式只用於前端顯示（`前8字 + ••• + 後4字`），DB 裡是明文
- 若未來要符合 SOC2 或類似合規，需要考慮 DB-level encryption 或 secret manager（Vercel 的 env vars 有加密）

## 地雷：`getAdminKeys()` 每次都 SELECT 整張 table

```ts
async function getAdminKeys(): Promise<Record<string, string>> {
  const rows = await sql`SELECT key_name, key_value FROM admin_keys`
  ...
}
```

table 很小（目前最多 8 行）所以不是問題。但如果未來 admin_keys 變成 per-tenant，這個 query 要加 WHERE 條件。
