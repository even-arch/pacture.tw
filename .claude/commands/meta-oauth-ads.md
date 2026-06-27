# Meta OAuth & Ads API — Pacture.tw

## App 基本資訊

- **App ID**：儲存在 `admin_keys.meta_app_id`（由 Admin 在後台設定）
- **App Secret**：儲存在 `admin_keys.meta_app_secret`
- **System User Token**：儲存在 `admin_keys.meta_system_user_token`（代管用戶用）
- **用戶 Access Token**：儲存在 `users.meta_access_token`（OAuth 後取得）
- **用戶 Ad Account ID**：儲存在 `users.meta_ad_account_id`

## OAuth 流程（兩段 token 交換）

### Step 1：發起授權

`GET /api/auth/meta` → redirect 到 Facebook Login Dialog：

```
https://www.facebook.com/v19.0/dialog/oauth
  ?client_id={appId}
  &redirect_uri=https://pacture.tw/api/auth/meta/callback
  &scope=ads_management,ads_read,business_management,pages_read_engagement
  &response_type=code
```

**授權的 scope 必須包含這四個**，缺一個就無法讀廣告資料。

### Step 2：Callback 處理（`GET /api/auth/meta/callback`）

```
code → short-lived token（1-2 小時）→ long-lived token（60 天）
```

**短效 token 交換：**
```
GET https://graph.facebook.com/v19.0/oauth/access_token
  ?client_id={appId}
  &client_secret={appSecret}
  &redirect_uri={redirectUri}
  &code={code}
```

**長效 token 交換（`fb_exchange_token`）：**
```
GET https://graph.facebook.com/v19.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={appId}
  &client_secret={appSecret}
  &fb_exchange_token={short_lived_token}
```

**地雷**：兩次都是 GET，不是 POST。Graph API 的 token 交換用 GET。

### Step 3：自動抓取廣告帳號

```
GET https://graph.facebook.com/v19.0/me/adaccounts
  ?fields=id,name,account_id
  &access_token={finalToken}
```

若用戶只有一個廣告帳號，自動存入 `users.meta_ad_account_id`。

## Ad Account ID 格式（重要）

Meta 的 Ad Account ID 有兩種格式：
- 數字格式：`123456789`
- 帶前綴格式：`act_123456789`

**Graph API 的 Insights endpoint 需要帶 `act_` 前綴**：

```ts
const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`
const url = `https://graph.facebook.com/v21.0/${id}/insights?...`
```

如果不加 `act_`，API 會回傳 `Invalid account id` 錯誤。

## 廣告成效 API（Insights）

```
GET https://graph.facebook.com/v21.0/{act_accountId}/insights
  ?fields=campaign_name,impressions,clicks,spend,actions,ad_id
  &date_preset=last_30d
  &access_token={token}
```

實作位置：`fetchMetaInsights()` in `app/api/ads/performance/route.ts`

**版本注意**：OAuth 流程用 `v19.0`，Insights API 用 `v21.0`。Meta 的 Graph API 版本可以混用，但不要讓它們差超過 2 個大版本（Meta 有 2 年的 deprecation 週期）。

## Token 過期問題

| Token 種類 | 有效期 | 處理方式 |
|-----------|--------|---------|
| Short-lived | 1-2 小時 | 立即換成 long-lived |
| Long-lived（用戶 OAuth）| 60 天 | 過期後用戶需重新授權 |
| System User Token | 永久（除非 revoke） | Admin 設定一次即可 |

**目前沒有 token 過期偵測機制**：60 天後 API call 會 fail，前端只會看到「成效資料載入失敗」。
未來應在 Insights API 回傳 401 時，在 UI 提示用戶重新授權。

## Redirect URI 設定

`https://pacture.tw/api/auth/meta/callback` 必須加入 Meta for Developers 的 Valid OAuth Redirect URIs。

本地開發若要測試 OAuth：
1. 在 Meta App 加入 `http://localhost:3000/api/auth/meta/callback`
2. 設定 `NEXT_PUBLIC_BASE_URL=http://localhost:3000`

## 已知的 Redirect URI 計算方式

```ts
const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/meta/callback`
```

**地雷**：如果 `NEXT_PUBLIC_BASE_URL` 末尾有 `/`，redirect URI 會變成 `https://pacture.tw//api/...`，Facebook 會回傳 `redirect_uri_mismatch`。

## callback 成功/失敗的 redirect

| 結果 | Redirect URL |
|------|-------------|
| 成功 | `/dashboard/settings?meta_connected=1` |
| 用戶取消 | `/dashboard/settings?meta_error=cancelled` |
| token 交換失敗 | `/dashboard/settings?meta_error=token` |
| Admin Key 未設定 | `/dashboard/settings?meta_error=config` |

`SettingsForm.tsx` 讀取這些 query param 顯示通知，5 秒後自動消失並清除 URL。
