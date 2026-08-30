import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { sharedReports } from "@/db/schema";
import { errorResponse } from "@/lib/errors";
import { notifyCritical } from "@/lib/critical-notify";
import { getSystemSettings, recordUsage } from "@/lib/service-control";

export const dynamic = "force-dynamic";

function isSafePayload(value: unknown): value is { report: unknown; ai?: unknown; mode?: "full" | "recap" | "achievements"; sections?: string[]; anonymous?: boolean } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const mode = record.mode;
  const sections = record.sections;
  return Boolean(record.report) && (!mode || mode === "full" || mode === "recap" || mode === "achievements") && (!sections || (Array.isArray(sections) && sections.every((item) => typeof item === "string") && sections.length <= 20)) && (!record.anonymous || typeof record.anonymous === "boolean") && JSON.stringify(value).length < 900_000;
}

export async function POST(request: Request) {
  try {
    const settings = await getSystemSettings();
    if (!settings.sharingEnabled) return errorResponse("SHARE-009", "分享服務目前由管理員暫停，請稍後再試。", 503, "S1");
    if (settings.testErrorCode?.startsWith("SHARE-")) return errorResponse(settings.testErrorCode, "這是管理員啟用的分享錯誤測試。", 503, "S1");
    await recordUsage("share");
    const body: unknown = await request.json();
    if (!isSafePayload(body)) return errorResponse("SHARE-001", "分享內容格式不正確。", 400, "S2");
    const id = randomBytes(18).toString("base64url");
    await db.insert(sharedReports).values({ id, payload: body });
    return Response.json({ id });
  } catch (error) {
    const dbError = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    const cause = dbError.cause ?? dbError;
    const code = cause.code || dbError.code || "UNKNOWN";
    const detail = cause.message || dbError.message || "";
    console.error("[share] database failure", code, detail);
    notifyCritical(code === "42P01" ? "SHARE-003" : "SHARE-009", `${code} ${detail}`);
    if (code === "42P01") return errorResponse("SHARE-003", "分享資料表尚未建立，請先在雲端資料庫執行建表 SQL，再重新部署。", 500, "S1");
    if (code === "28P01" || code === "3D000") return errorResponse("SHARE-005", "資料庫帳號或資料庫名稱無效，請檢查 Vercel 的 DATABASE_URL。", 500, "S1");
    if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "08001") return errorResponse("SHARE-004", "無法連線到 PostgreSQL，請檢查 DATABASE_URL、SSL 設定與資料庫是否允許外部連線。", 500, "S1");
    return errorResponse("SHARE-009", "目前無法建立分享報告，請稍後再試或回報錯誤代碼。", 500, "S1");
  }
}
