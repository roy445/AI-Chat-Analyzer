# 管理員後台資料庫 SQL

請在雲端 PostgreSQL 的 SQL Editor 執行，不需要在本機執行。

```sql
CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "analysis_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "ai_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "sharing_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "announcement" TEXT,
  "announcement_level" TEXT NOT NULL DEFAULT 'info',
  "test_error_code" TEXT,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO "system_settings" ("id") VALUES (1)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "usage_events" (
  "id" SERIAL PRIMARY KEY,
  "event_type" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "system_settings"
  ADD COLUMN IF NOT EXISTS "test_error_code" TEXT;
```

後台只會保存功能事件與時間，不保存姓名、IP、聊天內容或原始檔案。若你已經建立過 `system_settings`，最後一段 `ALTER TABLE` 可以安全執行補上測試欄位。
