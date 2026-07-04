-- 維修助理模組 — 增量 migration
-- 在 Neon SQL Editor 手動執行（比照 pacture_app 的規則：不可用 ORM push，直接下 SQL）
-- 執行前請先確認 lib/schema.sql 已套用（pgvector extension 已啟用）

-- knowledge_articles 加上來源類型，區分行銷知識庫（爬蟲）與維修知識庫（客戶手冊）
-- 兩者共用同一張表與同一套 ragQuery，只是用 source_type 隔開，避免互相污染檢索結果
ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'scraped';
ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS manual_id UUID;

-- 保固計算需要「購買日期」，但 getOrderDetail 回傳的明細目前沒有存這個欄位到 raw_data 頂層。
-- PI 列表（listProformaInvoices）本身有 createdDate，補存這欄，sync 時一併寫入。
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS created_date TEXT;

-- 上傳的維修手冊本身（檔案記錄 + 解析狀態）
CREATE TABLE IF NOT EXISTS repair_manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES users(id),
  product_category TEXT NOT NULL,
  title TEXT NOT NULL,
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'processing',  -- processing / ready / failed
  error TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE knowledge_articles
  ADD CONSTRAINT knowledge_articles_manual_id_fkey
  FOREIGN KEY (manual_id) REFERENCES repair_manuals(id) ON DELETE CASCADE;

-- 手冊零件名稱 ↔ Patisco SKU 對應表
-- 沒有對應到 SKU 的零件，AI 只能描述規格、不能觸發 QT 建立（見規劃文件第 7 章邊界）
-- 保固/墜車折扣規則不掛在單一零件上，改由 warranty_policies 依 product_category 統一設定
-- （品牌的保固制度是按「車架／輪組／零件／耗材」這種分類走，不是按單一零件各自訂）
CREATE TABLE IF NOT EXISTS manual_sku_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_category TEXT NOT NULL,
  part_name TEXT NOT NULL,          -- 手冊裡的零件描述/名稱
  patisco_sku TEXT,                 -- 對應的 Patisco SKU，NULL 代表尚未對應
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_category, part_name)
);

-- 保固／墜車折扣政策 — 這是「有就用、沒有不擋路」的加分精確層，不是必填前提。
-- 只有極少數品牌（例如 ENVE）公開了這麼精細的條款，值得先設好省去每次問人；
-- 大部分代理的品牌不會有這種文件，這張表留空也完全不影響維修助理運作——
-- 沒有設定時，AI 會改用 RAG 檢索到的內容回答，答不出來就轉去 repair_escalations 交給同仁。
-- 對應 ENVE 實際條款這種「瑕疵保固」與「墜車折扣重購方案」分開計算的結構：
--   - 瑕疵保固（defect）：終身或固定年限保固，免費換料件（不含工資）
--   - 墜車折扣（crash）：前 N 年免費，之後按固定折扣％重購，跟瑕疵保固是兩回事
--   - 正常磨損件：不論哪一種都不賠
CREATE TABLE IF NOT EXISTS warranty_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_category TEXT NOT NULL UNIQUE,
  is_wear_item BOOLEAN NOT NULL DEFAULT false,

  defect_lifetime BOOLEAN NOT NULL DEFAULT false,
  defect_years INTEGER,                          -- defect_lifetime=false 時的瑕疵保固年限
  defect_requires_original_owner BOOLEAN NOT NULL DEFAULT true,
  defect_subsequent_owner_years INTEGER,         -- 非原始買家的瑕疵保固年限（NULL=不適用），從製造日起算

  crash_discount_pct INTEGER,                    -- 墜車折扣重購的折扣％（30=打七折），NULL=此品類無此方案
  crash_free_years NUMERIC NOT NULL DEFAULT 0,   -- 墜車折扣方案中，前幾年是免費（0=從第一天就只有折扣、無免費期）
  crash_requires_original_owner BOOLEAN NOT NULL DEFAULT true,

  labor_included BOOLEAN NOT NULL DEFAULT false,
  claim_channel TEXT,                            -- 例如 'authorized_dealer'：需送原廠審核，不是店家/代理商能自行認定
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 維修助理對話 session（比照 pacture_app 的 ProductAiSession 設計，但 stage 改成維修情境）
-- stage: collecting -> recommending -> confirmed -> done，任何一輪答不出來都可以先進 escalated
CREATE TABLE IF NOT EXISTS repair_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  stage TEXT NOT NULL DEFAULT 'collecting',
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 每次 AI 給出的零件推薦記錄（不論最後有沒有建立 QT，都留痕供分析常見問題用）
CREATE TABLE IF NOT EXISTS repair_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES repair_sessions(id),
  part_name TEXT NOT NULL,
  patisco_sku TEXT,
  claim_type TEXT,                   -- defect / crash / null（尚無法判斷或查無購買紀錄）
  pay_percent_of_msrp INTEGER,       -- 0=原廠全額理賠、100=無理賠需全額購買、其餘為折扣後應付比例
  requires_oem_claim BOOLEAN NOT NULL DEFAULT false,  -- 是否需要另外向原廠（如 ENVE）送保固/墜車申請
  qt_status TEXT NOT NULL DEFAULT 'not_available',  -- not_available（Patisco Tool 未就緒）/ draft_created / skipped
  qt_reference TEXT,                 -- 若未來 Tool 就緒，記錄回傳的草稿 QT 編號
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 人工介入佇列：AI 判斷自己回答不出來（沒有足夠依據）時，丟進這裡讓同仁處理。
-- 核心閉環在這裡：同仁答完之後，答案要回寫進 knowledge_articles（見 lib/repair-assistant.ts 的 resolveEscalation），
-- 下次同類問題 AI 才答得出來，不用每次都問人。
CREATE TABLE IF NOT EXISTS repair_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES repair_sessions(id),
  product_category TEXT,             -- 有識別出來的話填，answer 回寫知識庫時要用
  question TEXT NOT NULL,            -- AI 摘要出「這輪答不出來的問題是什麼」
  status TEXT NOT NULL DEFAULT 'open',  -- open / answered
  staff_answer TEXT,
  answered_by UUID REFERENCES users(id),
  answered_at TIMESTAMPTZ,
  learned BOOLEAN NOT NULL DEFAULT false,  -- 答案是否已經回寫進 knowledge_articles
  created_at TIMESTAMPTZ DEFAULT now()
);
