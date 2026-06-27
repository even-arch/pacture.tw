# Google Ads API — Pacture.tw

## 目前實作狀態：大部分是 Stub

`fetchGoogleAdsMetrics()` in `app/api/ads/performance/route.ts` 目前直接回傳空陣列：

```ts
async function fetchGoogleAdsMetrics(_token: string, _customerId: string): Promise<AdMetrics[]> {
  // Google Ads API requires OAuth2 + developer token setup
  // Stub: returns empty until OAuth flow is implemented
  return []
}
```

**已實作的部分**：
- 憑證儲存（Developer Token、Customer ID 寫入 users table）
- MCC 架構的設計（admin_keys 有 `google_ads_manager_customer_id`）
- UI 顯示（PerformancePanel 的「已連結」狀態檢查）

**未實作的部分**：
- 真正的 Google Ads API call
- OAuth2 flow（不像 Meta 有簡單的 token，Google Ads 需要完整 OAuth2）
- 廣告投放 API

## MCC（Manager Customer）架構

Google Ads 的多帳號管理機制，Pacture.tw 用這個架構代管用戶的廣告：

```
MCC Account（Manager）
├── Customer Account A（用戶甲的廣告帳號）
└── Customer Account B（用戶乙的廣告帳號）
```

三層 ID：
| ID | 說明 | 儲存位置 |
|----|------|---------|
| Developer Token | 向 Google 申請，全平台共用 | `admin_keys.google_ads_developer_token` |
| Manager Customer ID（MCC ID）| Pacture.tw 自己的 Manager 帳號 | `admin_keys.google_ads_manager_customer_id` |
| Customer ID | 用戶自己的廣告帳號 ID | `users.google_ads_customer_id` |

格式：所有 Customer ID 格式都是 `xxx-xxx-xxxx`（10位數字加連字號）。

## 實作 Google Ads API 的前置條件

要真正打 Google Ads API，需要：

1. **Developer Token**：已有，存在 admin_keys
2. **OAuth2 Client ID + Secret**：需要在 Google Cloud Console 建立 OAuth2 應用
3. **用戶 OAuth 授權**：用戶必須授權 Pacture.tw 存取他的 Google Ads 帳號（類似 Meta OAuth）
4. **`login-customer-id` header**：以 MCC 身份操作子帳號時，request header 必須帶：
   ```
   login-customer-id: {MCC_ID}（去掉連字號的純數字）
   customer-id: {用戶的 Customer ID}
   ```

## API 端點（真正實作時用）

Google Ads API 不是 REST，是 **gRPC** 或 **REST API（v18）**：

```
POST https://googleads.googleapis.com/v18/customers/{customerId}/googleAds:search
Authorization: Bearer {oauth2_token}
developer-token: {developer_token}
login-customer-id: {mcc_customer_id}
```

GAQL（類 SQL）查詢語言範例：
```sql
SELECT
  campaign.name,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
```

**注意**：`cost_micros` 是微元（USD × 1,000,000），顯示時要除以 1,000,000。

## 建議的實作順序

1. 先建立 Google Cloud OAuth2 Client（Web Application 類型）
2. 加入 Google Ads OAuth2 flow（類似現有的 Meta OAuth，但 scope 不同）
   - Scope：`https://www.googleapis.com/auth/adwords`
3. 儲存 OAuth2 refresh token 到 users table（需新增欄位 `google_ads_refresh_token`）
4. 實作 `fetchGoogleAdsMetrics()` 用 refresh token 換 access token 再打 API
5. 整合到 `PerformancePanel`

## 現有 UI 的連結判斷邏輯

`app/api/ads/performance/route.ts`：
```ts
const hasGoogle = !!(user?.google_ads_developer_token && user?.google_ads_customer_id)
```

**問題**：`google_ads_developer_token` 是 admin_keys 的，不是 user 的。用戶根本不能自己填 dev token（代管用戶的 UI 也沒有這個欄位）。

正確的「已連結」判斷應改為：
- 代管用戶：`admin_keys.google_ads_developer_token` 有值 + `users.google_ads_customer_id` 有值
- 自助用戶：`users.google_ads_developer_token` 有值 + `users.google_ads_customer_id` 有值

這個邏輯目前是錯的，等實作完整 API 時要一起修。
