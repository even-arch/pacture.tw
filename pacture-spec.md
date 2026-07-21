# Pacture — 專案規格文件

給 Claude Code 的開發指引。本文件包含完整背景、技術決策與 v1 開發範圍。

---

## 1\. 專案背景

**Pacture**（取 Capture 諧音）是 Xinosys（錫諾系統）旗下的 SaaS 服務，定位為「臺灣出口貿易 B2B 行銷智囊」。

### 公司脈絡

- **Xinosys**：開發公司，本專案的第一個測試客戶  
- **Patisco / 貿商道**：B2B 自行車零件交易平台，Pacture 的資料來源  
- **Point Asia**：自行車零件銷售公司（Xinosys 旗下）  
- **Pedaling Forward**：原有的腳踏車店合作計畫，累積了 400+ 家國際店家名單

### 核心問題

Point Asia 銷售臺灣工廠製造的補修市場（aftermarket）零件，廠商大多無自有品牌。行銷難點在於無法靠品牌名稱建立信任，必須從「這個零件能解決你的問題」切入。目前缺乏系統化的內容生產與廣告投放機制。

### 解決方案

Pacture 自動從 Patisco 的訂單資料出發，抓取對應零件的網路知識，生成針對特定地區、語言、渠道的廣告文案，並投放到 Meta / Google 廣告平台，最後回收成效數據產出報告。

---

## 2\. 服務流程（核心邏輯）

```
Patisco 帳號登入
    ↓
透過 Patisco MCP Server 拉取訂單資料（品類、客戶地區）
    ↓
根據品類觸發爬蟲，抓取相關零件知識（規格、補修情境、評測）
    ↓
向量化存入知識庫
    ↓
RAG 引擎比對「品類 × 地區 × 語言 × 渠道」生成文案草稿
    ↓
人工審核（v1）→ 自動推送廣告平台（v2）
    ↓
Insights API 回收成效數據
    ↓
自動產出週報 / 月報
```

---

## 3\. 技術堆疊

| 層次 | 工具 | 說明 |
| :---- | :---- | :---- |
| Frontend \+ API Routes | **Next.js on Vercel** | Web Dashboard \+ REST API |
| 關聯式資料庫 | **Neon (PostgreSQL)** | 訂單快取、用戶資料、廣告成效數據 |
| 向量資料庫 | **Neon pgvector** | 零件知識 embedding，做 RAG 用 |
| AI 核心 | **Claude API (Anthropic)** | 文案生成、摘要、報告 |
| 爬蟲 | **Firecrawl** 或 Playwright | JS-rendered 頁面需要 Playwright |
| 排程/工作流 | **Vercel Cron** 或 **Cloudflare Workers** | 定時爬蟲、定時報告 |
| DNS / CDN | **Cloudflare** | pacture.tw 的 DNS 管理 |
| 廣告 API | **Meta Marketing API** / **Google Ads API** | v2 再接 |
| 成效數據 | **Meta Insights API** / **Google Ads Reporting** | v2 再接 |
| Email 報告 | **Resend** 或 **SendGrid** | 自動寄送週報 |

### Domain

- `pacture.tw`（已有，Cloudflare 管理）

### 重要：Patisco MCP Server

- Patisco 有開放 MCP Server，可查詢訂單內容與用戶資料  
- 已在 Paxis 專案中驗證串接可行，確認通暢  
- 登入後透過 MCP 取得該帳號的訂單列表與客戶屬性

---

## 4\. V1 範圍（第一版，僅此範圍）

### 包含

1. **Patisco 帳號登入** — OAuth 或 API Key 方式，串接 Patisco MCP Server  
2. **訂單資料顯示** — 列出該帳號的訂單，包含品類與客戶地區  
3. **爬蟲觸發** — 根據訂單品類，抓取對應零件的網路資料並存入 Neon pgvector  
4. **文案生成介面** — 選擇品類 \+ 目標地區 \+ 語言，呼叫 Claude API 生成 3 個版本文案  
5. **人工審核與複製** — 用戶可在介面上審核文案，一鍵複製貼到廣告平台

### 不包含（v2 以後）

- Meta / Google API 自動推送  
- 成效數據回收  
- 自動週報  
- 多租戶（Multi-tenant）架構

### 第一個測試客戶

- **Xinosys**（錫諾系統）— 用 Xinosys 的 Patisco 帳號與廣告帳號測試整條流程

---

## 5\. 資料庫 Schema（初版）

```sql
-- 用戶（v1 單一用戶，v2 再擴展）
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  patisco_account TEXT,          -- Patisco 帳號識別
  patisco_api_key TEXT,          -- MCP Server 存取金鑰
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 訂單快取（從 Patisco MCP 拉回來的資料）
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  patisco_order_id TEXT,
  product_category TEXT,         -- 零件品類（例如：pedal, seatpost, chainring）
  customer_region TEXT,          -- 客戶地區（例如：DE, CA, US-WA）
  customer_language TEXT,        -- 推導語言（例如：de, en, fr）
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- 知識庫文章（爬蟲抓回來的內容）
CREATE TABLE knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_category TEXT NOT NULL,
  source_url TEXT,
  title TEXT,
  content TEXT,
  embedding VECTOR(1536),        -- pgvector
  scraped_at TIMESTAMPTZ DEFAULT now()
);

-- 生成的文案
CREATE TABLE copy_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  order_id UUID REFERENCES orders(id),
  product_category TEXT,
  target_region TEXT,
  language TEXT,
  channel TEXT,                  -- facebook, instagram, google
  versions JSONB,                -- [{angle, body, hook}, ...]
  status TEXT DEFAULT 'draft',   -- draft, approved, published
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6\. 爬蟲目標來源（依優先順序）

補修市場的知識庫重點不是品牌，而是「情境與問題」：

1. **Park Tool** (parktool.com) — 維修教學，「什麼時候需要換這個零件」  
2. **Sheldon Brown** (sheldonbrown.com) — 規格標準、相容性  
3. **BikeGremlin** (bikegremlin.com) — 技術說明、補修情境  
4. **Reddit r/bikewrench** — 真實技師語言（需處理 Reddit API）  
5. **臺灣廠商英文官網** — VP Components、Wellgo、SUPER B 等，產品規格數據

---

## 7\. 文案生成 Prompt 結構

```
系統提示：
你是一位專業的自行車零件行銷文案撰寫人，服務對象是自行車維修技師與店主。
語氣：專業但不冷漠，技師對技師的口吻。
避免：過度品牌語言（這是補修市場，無自有品牌）。
重點：解決問題、相容性、補修情境。

使用者提示：
品類：{product_category}
目標地區：{region}
語言：{language}
渠道：{channel}（Facebook 貼文 / Instagram 圖說 / Google 展示廣告）
參考資料：{從 RAG 撈回的知識庫片段}

請生成 3 個版本，各有不同切入角度：
1. 痛點切入（描述問題情境）
2. 專業認同切入（技師對技師）
3. 好奇心切入（意想不到的角度）
每個版本包含：標題（hook）、主文（body，80字以內）。
```

---

## 8\. 專案目錄結構

```
pacture/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx          # Patisco 帳號登入
│   ├── dashboard/
│   │   ├── page.tsx                # 訂單概覽
│   │   ├── orders/page.tsx         # 訂單列表
│   │   └── copy/page.tsx           # 文案生成介面
│   └── api/
│       ├── patisco/sync/route.ts   # 從 MCP Server 同步訂單
│       ├── scrape/route.ts         # 觸發爬蟲
│       ├── generate/route.ts       # 呼叫 Claude API 生成文案
│       └── knowledge/route.ts      # 知識庫查詢
├── lib/
│   ├── patisco-mcp.ts              # Patisco MCP Server 客戶端
│   ├── scraper.ts                  # 爬蟲邏輯
│   ├── embeddings.ts               # 向量化與 RAG 查詢
│   └── claude.ts                   # Claude API 封裝
├── components/
│   ├── OrderList.tsx
│   ├── CopyGenerator.tsx
│   └── CopyCard.tsx
└── CLAUDE.md                       # 給 Claude Code 的專案說明
```

---

## 9\. 開發順序

### Sprint 1（先跑通主流程）

1. 建立 Next.js 專案，部署到 Vercel，連接 Neon  
2. 建立 DB schema，啟用 pgvector  
3. 實作 Patisco MCP 連線，拉取訂單資料  
4. 訂單列表頁面

### Sprint 2（知識庫）

5. 爬蟲模組（先從 Park Tool、Sheldon Brown 開始）  
6. 向量化存入 Neon pgvector  
7. RAG 查詢函式

### Sprint 3（文案生成）

8. Claude API 整合，帶入 RAG 結果  
9. 文案生成介面（選品類、地區、語言、渠道）  
10. 三版本文案展示與複製功能

### Sprint 4（收尾）

11. 基本 UI 整理  
12. Xinosys 帳號端對端測試  
13. 部署確認

---

## 10\. 環境變數（需在 Vercel 設定）

```
# Claude API
ANTHROPIC_API_KEY=

# Neon PostgreSQL
DATABASE_URL=

# Patisco MCP Server
PATISCO_MCP_URL=
PATISCO_API_KEY=

# Firecrawl（爬蟲）
FIRECRAWL_API_KEY=

# （v2）Meta
META_APP_ID=
META_APP_SECRET=

# （v2）Google
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
```

---

## 備註

- v1 不做 Multi-tenant，登入即為 Xinosys 單一用戶  
- 廣告平台 API（Meta / Google）v2 才接，v1 文案純手動貼  
- Patisco MCP 串接邏輯參考 Paxis 專案的實作  
- pacture.tw DNS 在 Cloudflare 管理，Vercel 部署時需設定 Custom Domain

