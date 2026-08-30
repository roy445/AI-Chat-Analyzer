import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { errorTestHistory, systemSettings, usageEvents } from "@/db/schema";
import { errorInfo } from "@/lib/error-catalog";

export type UsageEventType =
  | "analysis_start" | "analysis_complete" | "ai_start" | "ai_complete"
  | "file_parse_start" | "file_parse_complete" | "share_create" | "share_view"
  | "analysis" | "ai" | "share" | "file_parse";

export async function getSystemSettings() {
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
  return rows[0] || { id: 1, analysisEnabled: true, aiEnabled: true, sharingEnabled: true, announcement: null, announcementLevel: "info", testErrorCode: null, updatedAt: new Date() };
}

export async function recordUsage(eventType: UsageEventType) {
  try { await db.insert(usageEvents).values({ eventType }); }
  catch (error) { console.error("[usage] unable to record event", error); }
}

export async function recordError(code: string, message: string, severity: string, source = "real") {
  try {
    await db.insert(errorTestHistory).values({ code, name: errorInfo(code).name, severity, source, message: message.slice(0, 500) });
    if (source === "real" && (severity === "S0" || severity === "S1")) {
      await db.update(systemSettings).set({ announcement: `系統偵測到重大錯誤（${code}），部分功能可能暫時無法使用。我們正在處理，請稍後再試。`, announcementLevel: severity === "S0" ? "critical" : "warning", updatedAt: new Date() }).where(eq(systemSettings.id, 1));
    }
  } catch (error) { console.error("[error-history] unable to record error", error); }
}

export async function stopActiveError(code: string) {
  try { await db.update(errorTestHistory).set({ stoppedAt: new Date() }).where(and(eq(errorTestHistory.code, code), isNull(errorTestHistory.stoppedAt))); }
  catch (error) { console.error("[error-history] unable to stop error", error); }
}
