# Multi-Tenant 架構 — Pacture.tw

## 現況：1 User = 1 Tenant

目前所有資料表都以 `user_id` 為隔離單位。這代表：
- 一個公司只能有一個帳號
- 多個員工無法共用同一份 PI 資料
- 沒有「組織」的概念

這個設計在初期 MVP 是可行的，但**不能支撐真正的 Multi-tenant SaaS**。

## URL 設計的問題（用戶指出的核心問題）

現在的 URL 結構完全沒有 tenant 識別符：
```
pacture.tw/dashboard
pacture.tw/dashboard/settings
pacture.tw/dashboard/orders
```

這意味著：
1. 無法在 URL 層面區分不同租戶
2. 無法做 subdomain routing（`company-a.pacture.tw`）
3. 未來要加 org 概念時，所有 link、redirect、cookie 都要跟著改

## 三種 Multi-tenant URL 模式的比較

### 方案 A：Subdomain（`tenant.pacture.tw`）
```
company-a.pacture.tw/dashboard
company-b.pacture.tw/dashboard
```

**優點**：最乾淨的隔離，方便做 custom domain（`ads.company-a.com` → Vercel）
**缺點**：
- 需要 wildcard DNS（`*.pacture.tw`）
- Next.js 需要 middleware 從 `host` header 讀出 tenant slug
- Vercel 免費方案不支援 wildcard subdomain，需要 Pro
- Cookie domain 需設 `.pacture.tw`

**適合**：企業級、要做 white-label

### 方案 B：Path Prefix（`pacture.tw/app/[orgSlug]/dashboard`）
```
pacture.tw/app/patisco/dashboard
pacture.tw/app/acme/dashboard
```

**優點**：最簡單，不需要 DNS 設定，Vercel 免費方案可用
**缺點**：URL 較長，所有頁面都要在 `app/app/[orgSlug]/` 下重新組織

**適合**：初期 MVP 擴展，改動最小

### 方案 C：Session-based（現況）
```
pacture.tw/dashboard   （所有 tenant 共用 URL，靠 cookie 區分）
```

**優點**：不需改 URL，改動最小
**缺點**：
- 無法支援多用戶共用資料（因為 cookie 裡只有 userId）
- 無法做 org-level 設定
- 無法在同一瀏覽器切換不同 tenant

**適合**：只有「1公司1帳號」的場景，永遠不需要多用戶

## 推薦的演進路徑

### 短期（MVP 擴展）：加 `org_id` 但保持現有 URL

1. 新增 `organizations` table：
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,   -- URL 用（方案B需要）
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

2. `users` 加 `org_id` FK：
```sql
ALTER TABLE users ADD COLUMN org_id UUID REFERENCES organizations(id);
```

3. 資料表（proforma_invoices, copy_drafts, analysis_results）加 `org_id`，查詢改為 `WHERE org_id = ${session.orgId}`

4. Session 加入 `orgId`：
```ts
interface Session {
  userId: string
  orgId: string      // 新增
  email: string
  role: 'owner' | 'member'   // org 內角色
  serviceTier?: string
}
```

5. `admin_keys` 不動（仍是全域共用）

### 中期（Path Prefix）：URL 加 org slug

把 `app/dashboard/` 移動到 `app/app/[orgSlug]/dashboard/`，middleware 驗證 slug 對應到 session 的 orgId。

### 長期（Subdomain）：`tenant.pacture.tw`

需要 Vercel Pro + wildcard DNS + middleware 讀 host header。

## 現有 API 的資料隔離漏洞

以下 API route 目前直接用 `userId` 查詢，改 multi-tenant 時都要改：

| Route | 現況 | 改法 |
|-------|------|------|
| `/api/analysis` | `WHERE user_id = ${userId}` | 改 `WHERE org_id = ${orgId}` |
| `/api/drafts` | `WHERE user_id = ${userId}` | 改 `WHERE org_id = ${orgId}` |
| `/api/orders` | `WHERE user_id = ${userId}` | 改 `WHERE org_id = ${orgId}` |
| `/api/patisco/sync` | 讀 `users` 的 JWT/Key by userId | 改讀 org-level 憑證 |
| `/api/generate` | `getUserKeys(userId)` | `getOrgKeys(orgId)` |
| `/api/settings` | `SELECT * FROM users WHERE id = ${userId}` | 拆成 user profile + org settings |

## `admin_keys` 的角色定位（不變）

`admin_keys` 是 Pacture.tw **平台層**的 key，不是某個租戶的。
- Anthropic / OpenAI / Firecrawl：平台付費，代管用戶用
- Google Ads Developer Token + MCC ID：平台的 Google Ads Manager 帳號
- Meta App ID / Secret：平台的 Facebook App

這些**不需要 multi-tenant 化**，繼續保持全域共用。

## 要動手前必須先確認的問題

1. Patisco 憑證是公司層級還是個人層級？（決定 org-level 還是 user-level 存放）
2. 一個公司預計有幾個用戶同時使用？
3. 廣告帳號（Google Customer ID、Meta Ad Account）是公司共用還是每個用戶各自的？
4. 要不要做 URL subdomain？（影響 DNS 和 Vercel 計畫）
