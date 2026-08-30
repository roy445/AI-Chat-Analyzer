import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { announcementHistory, errorTestHistory, systemSettings, usageEvents } from "@/db/schema";
import { errorInfo } from "@/lib/error-catalog";

export type UsageEventType =
  | "analysis_start" | "analysis_complete" | "ai_start" | "ai_complete"
  | "file_parse_start" | "file_parse_complete" | "share_create" | "share_view"
  | "analysis" | "ai" | "share" | "file_parse";

export async function getSystemSettings() {
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
  const current = rows[0];
  if (current?.announcementExpiresAt && current.announcementExpiresAt <= new Date()) { await db.update(systemSettings).set({ announcement: null, announcementLevel: "info", announcementExpiresAt: null, updatedAt: new Date() }).where(eq(systemSettings.id, 1)); return { ...current, announcement: null, announcementLevel: "info", announcementExpiresAt: null }; }
  return current || { id: 1, analysisEnabled: true, aiEnabled: true, sharingEnabled: true, announcement: null, announcementLevel: "info", announcementExpiresAt: null, testErrorCode: null, updatedAt: new Date() };
}

export async function recordUsage(eventType: UsageEventType, sessionId?: string, page?: string) {
  try { await db.insert(usageEvents).values({ eventType, sessionId: sessionId?.slice(0, 100), page: page?.slice(0, 120) }); }
  catch (error) { console.error("[usage] unable to record event", error); }
}

export async function recordError(code: string, message: string, severity: string, source = "real") {
  try {
    await db.insert(errorTestHistory).values({ code, name: errorInfo(code).name, severity, source, message: message.slice(0, 500) });
    if (source === "real" && (severity === "S0" || severity === "S1")) {
      const announcement = publicAnnouncement(code);
      await db.update(systemSettings).set({ announcement, announcementLevel: severity === "S0" ? "critical" : "warning", updatedAt: new Date() }).where(eq(systemSettings.id, 1));
      await db.insert(announcementHistory).values({ message: announcement, level: severity === "S0" ? "critical" : "warning", source: "auto" });
    }
  } catch (error) { console.error("[error-history] unable to record error", error); }
}

function publicAnnouncement(code: string) {
  if (code.startsWith("AI-")) return "AI 分析服務目前暫時忙碌，請稍後再試。基本報告仍可繼續查看。";
  if (code.startsWith("SHARE-")) return "分享服務目前正在維護，暫時無法建立或查看分享連結，請稍後再試。";
  if (code.startsWith("FILE-")) return "檔案解析服務遇到問題，請確認檔案格式後稍後重新上傳。";
  if (code.startsWith("ANALYSIS-")) return "分析服務目前正在處理異常，請稍後重新開始分析。";
  if (code.startsWith("DB-") || code.startsWith("DEPLOY-")) return "部分服務正在維護，部分功能可能暫時無法使用，請稍後再試。";
  if (code.startsWith("SYSTEM-")) return "系統目前正在處理異常狀況，部分功能可能暫時無法使用，請稍後再試。";
  return "部分服務目前暫時無法使用，我們正在處理，請稍後再試。";
}

export async function stopActiveError(code: string) {
  try { await db.update(errorTestHistory).set({ stoppedAt: new Date() }).where(and(eq(errorTestHistory.code, code), isNull(errorTestHistory.stoppedAt))); }
  catch (error) { console.error("[error-history] unable to stop error", error); }
}

export async function resolveRealError(code: string) {
  try {
    const now = new Date();
    const active = await db.select({ id: errorTestHistory.id }).from(errorTestHistory).where(and(eq(errorTestHistory.code, code), eq(errorTestHistory.source, "real"), isNull(errorTestHistory.stoppedAt))).limit(1);
    if (!active[0]) return;
    await db.update(errorTestHistory).set({ stoppedAt: now }).where(eq(errorTestHistory.id, active[0].id));
    await db.update(announcementHistory).set({ revokedAt: now }).where(and(eq(announcementHistory.source, "auto"), isNull(announcementHistory.revokedAt)));
    const recovery = "服務已恢復正常，先前的錯誤已解除。感謝你的耐心等候。";
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await db.update(systemSettings).set({ announcement: recovery, announcementLevel: "info", announcementExpiresAt: expiresAt, updatedAt: now }).where(eq(systemSettings.id, 1));
    await db.insert(announcementHistory).values({ message: recovery, level: "info", source: "auto", expiresAt });
  } catch (error) { console.error("[error-history] unable to resolve error", error); }
}
