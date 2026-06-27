# Session & Auth — Pacture.tw

## 兩套獨立的 Cookie 系統

這個專案同時存在兩個 cookie，彼此完全獨立，不共用：

| | 用戶 Session | Admin Session |
|---|---|---|
| Cookie 名稱 | `session` | `admin_session` |
| 結構 | `{ userId, email, serviceTier }` | `{ adminId, email }` |
| 讀取函式 | `lib/session.ts` → `getSession()` | `lib/admin-auth.ts` → `getAdminSession()` |
| 登入端點 | `POST /api/auth` | `POST /api/admin/login` |
| 設定 | httpOnly, SameSite=lax, path=/ | httpOnly, SameSite=lax, path=/ |

## 用戶 Session（`lib/session.ts`）

```ts
export interface Session {
  userId: string
  email: string
  serviceTier?: string   // 'self' | 'managed'
}

export async function getSession(): Promise<Session | null>
export async function requireSession(): Promise<Session>  // 未登入 → redirect('/login')
```

`requireSession()` 在 Server Component 或 Route Handler 最頂端呼叫，未登入直接 redirect，不用手動判斷。

## Admin Session（`lib/admin-auth.ts`）

```ts
export async function getAdminSession(): Promise<{ adminId: string; email: string } | null>
```

Admin route 的保護寫法：
```ts
const session = await getAdminSession()
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

Admin 只有在 `users.role = 'admin'` 的帳號才能登入（`POST /api/admin/login` 有驗證）。

## 密碼處理
- 套件：`bcryptjs`（純 JS，不需要 native binary）
- hash：`bcrypt.hash(password, 10)`
- 驗證：`bcrypt.compare(password, hash)`
- 初始 admin 密碼在 `scripts/migrate-admin.mjs` 裡 hash 後寫入 DB

## 用戶狀態邏輯
登入時 (`POST /api/auth`) 的檢查順序：
1. Email 存在？
2. 密碼正確？
3. `status === 'suspended'`？→ 403，回傳中文錯誤訊息
4. 通過 → 寫入 session cookie（含 `serviceTier`）

## serviceTier 的用途
Session 裡的 `serviceTier` 控制 UI 顯示邏輯：
- `'managed'`：隱藏 AI/爬蟲 key 設定區、隱藏 nav 中的設定齒輪（在 `dashboard/layout.tsx` 處理）
- `'self'`：完整顯示所有設定

**地雷**：`serviceTier` 儲存在 cookie，不是即時從 DB 讀。Admin 改完 tier 後，用戶要重新登入才會生效。若需即時生效，需在 Server Component 重新查 DB。

## Route Handler 裡讀 Session 的正確寫法

Server Component（async function）：
```ts
const session = await requireSession()
```

Route Handler（不能用 requireSession，因為要回傳 JSON 而非 redirect）：
```ts
const store = await cookies()
const raw = store.get('session')?.value
if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const { userId } = JSON.parse(raw)
```

**注意**：目前 Route Handler 直接 `JSON.parse(raw)` 而沒有 try/catch，若 cookie 被竄改會 throw。正確做法應加 try/catch。

## 已知缺口（Multi-tenant 前必須補）
- Session 只有 `userId`，沒有 `orgId`
- 目前 1 user = 1 tenant，若要多用戶共用同一組資料，需加 `orgId` 到 Session
- Admin session 沒有 role 細分（未來若需要多層 admin 權限要設計）
