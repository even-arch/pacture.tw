# Patisco MCP 整合 — Pacture.tw

## 基本資訊

- **MCP Server URL**：`https://mcp.patisco.com/mcp`
- **協議**：MCP over HTTP，回應為 SSE（Server-Sent Events）格式
- **認證**：每個 request 帶兩個 header
  - `Authorization: Bearer {patisco_jwt}`
  - `X-Api-Key: {patisco_api_key}`
- **實作位置**：`lib/patisco-mcp.ts`

## SSE 回應解析（重要地雷）

Patisco MCP 的回應不是純 JSON，而是 SSE 格式：
```
data: {"jsonrpc":"2.0","id":2,"result":{...}}
```

解析方式：
```ts
const text = await res.text()
const dataLine = text.split('\n').find((l) => l.startsWith('data: '))
if (!dataLine) throw new Error(`No data in response: ${text}`)
const json = JSON.parse(dataLine.slice(6))   // 去掉 "data: " 前綴
```

**不能直接 `res.json()`**，會失敗。

## Session 建立與重用（重要）

MCP 要先建立 session，後續的 tool call 必須帶同一個 `mcp-session-id`：

```ts
// Step 1：Initialize（取得 session ID）
const res = await fetch(MCP_URL, {
  method: 'POST',
  headers: { ...auth headers... },
  body: JSON.stringify({
    jsonrpc: '2.0', id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'pacture', version: '1.0.0' },
    },
  }),
})
const sessionId = res.headers.get('mcp-session-id') ?? ''

// Step 2：後續 tool call 帶 session ID
headers['Mcp-Session-Id'] = sessionId
```

**地雷**：
- `listProformaInvoices` 也會建立一個 session，但不能拿來用於後續 `getOrderDetail`
- 同步時必須另外呼叫 `createSession()` 一次，再用那個 session 做所有 `getOrderDetail`
- 每個 `getOrderDetail` 的 call ID（`id` 欄位）必須不同，目前用 `i + 10` 避開與 initialize 的 id 1 衝突

## Tool 清單

### `listProformaInvoices`
```ts
await mcpRequest(session, 2, 'tools/call', {
  name: 'listProformaInvoices',
  arguments: { fetchAll: true },
})
```

回傳結構：
```ts
{
  items: PatiscoPIListItem[]
  totalCount: number
  statusBreakdown: { confirmed: number; archived: number }
}
```

`PatiscoPIListItem` 欄位：`id, no, status, buyer, price, itemsCount, currencyCode, createdDate, lastModifiedDate, po`

### `getOrderDetail`
```ts
await mcpRequest(session, callId, 'tools/call', {
  name: 'getOrderDetail',
  arguments: { orderId: pi.id },
})
```

回傳結構（`result.structuredContent`）：
```ts
{
  detail: {
    id, no, status,
    buyer: { id, name, countryCode, city, email, companyName, website },
    seller: { name, countryCode },
    shippingInfo: { countryCode },
  },
  products: {
    items: [{ id, sku, modelNo, specification, note, price, quantity, unit }]
  }
}
```

**注意**：products 在 `result.structuredContent.products.items`，不是在 `detail` 裡面。

## 同步流程

`POST /api/patisco/sync` 的完整流程：

1. 讀取該 user 的 `patisco_jwt` 和 `patisco_api_key`
2. `listProformaInvoices()` — 內部建立自己的 session
3. `createSession()` — 另建一個 session 供後續 detail 使用
4. 對每個 PI 呼叫 `getOrderDetail(session, pi.id, i + 10)`
5. UPSERT 到 `proforma_invoices`：
   - 買方國家：`detail.buyer?.countryCode ?? detail.shippingInfo?.countryCode`
   - 商品 SKU 陣列：`[...new Set(products.map(p => p.sku))]`
   - 狀態 mapping：`{ '3': 'confirmed', '2': 'archived', '1': 'pending', '0': 'draft' }`
6. `raw_data` 存完整 detail（JSONB），後續分析從 `raw_data` 裡讀欄位

## Route 設定

```ts
export const maxDuration = 300   // 5 分鐘，因為要逐筆抓 PI detail
```

PI 數量多時會很慢，不要縮短 timeout。

## Admin 代操流程

`POST /api/admin/operate`：
- 讀取的是 **目標 user** 的 JWT/Key（不是 admin 自己的）
- 資料寫入 `proforma_invoices` 時 `user_id` 仍是目標 user 的 ID
- Admin 沒有自己的 Patisco 憑證

## 常見錯誤

| 錯誤訊息 | 原因 |
|---------|------|
| `No data in response` | SSE 解析失敗，通常是認證錯誤（JWT 過期） |
| `MCP error 401` | JWT 無效或過期，要用戶重新設定 |
| `MCP error -32601` | Tool name 拼錯 |
| `structuredContent is undefined` | call ID 衝突或 session 過期，重新建立 session |
