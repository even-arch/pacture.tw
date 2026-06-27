-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 用戶（v1 單一用戶）
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  patisco_api_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PI 快取（從 Patisco MCP 拉回來的形式發票）
CREATE TABLE IF NOT EXISTS proforma_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  pi_id TEXT NOT NULL,               -- Patisco PI ID
  pi_no TEXT,                        -- PI 單號
  po_id TEXT,                        -- 關聯 PO ID
  po_no TEXT,                        -- 關聯 PO 單號
  product_categories TEXT[],         -- 零件品類列表
  customer_region TEXT,              -- 客戶地區（國碼）
  customer_language TEXT,            -- 推導語言
  status TEXT,                       -- confirmed / archived
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, pi_id)
);

-- 知識庫文章（爬蟲抓回來的內容）
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_category TEXT NOT NULL,
  source_url TEXT,
  title TEXT,
  content TEXT,
  embedding VECTOR(1536),
  scraped_at TIMESTAMPTZ DEFAULT now()
);

-- 生成的文案
CREATE TABLE IF NOT EXISTS copy_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  pi_id UUID REFERENCES proforma_invoices(id),
  product_category TEXT,
  target_region TEXT,
  language TEXT,
  channel TEXT,                      -- facebook, instagram, google
  versions JSONB,                    -- [{angle, hook, body}, ...]
  status TEXT DEFAULT 'draft',       -- draft, approved
  created_at TIMESTAMPTZ DEFAULT now()
);
