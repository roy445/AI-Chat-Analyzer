import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { announcementHistory, errorTestHistory, supportTickets, systemSettings, usageEvents } from "@/db/schema";
import { errorInfo } from "@/lib/error-catalog";
import { clearAdminCookie, isAdmin, setAdminCookie, validPassword } from "@/lib/admin-auth";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { action?: string; password?: string; analysisEnabled?: boolean; aiEnabled?: boolean; sharingEnabled?: boolean; announcement?: string; announcementLevel?: string; testErrorCode?: string | null; eventType?: string; ticketNumber?: string; status?: string };
  if (body.action === "login") { if (!validPassword(body.password || "")) return errorResponse("ADMIN-001", "管理員密碼不正確或尚未設定。", 401, "S1"); const response = Response.json({ ok: true }); setAdminCookie(response); return response; }
  if (body.action === "logout") { const response = Response.json({ ok: true }); clearAdminCookie(response); return response; }
  if (!(await isAdmin())) return errorResponse("ADMIN-002", "需要管理員登入才能執行這個操作。", 401, "S2");
  try {
    if (body.action === "log") { if (!body.eventType) return errorResponse("ADMIN-003", "不支援的使用事件類型。", 400, "S2"); await db.insert(usageEvents).values({ eventType: body.eventType }); return Response.json({ ok: true }); }
    if (body.action === "ticket_status") { const ticketNumber = body.ticketNumber?.trim(); const nextStatus = body.status?.trim(); if (!ticketNumber || !["new", "in_progress", "resolved", "ignored"].includes(nextStatus || "")) return errorResponse("ADMIN-007", "案件單號或處理狀態無效。", 400, "S2"); const updatedAt = new Date(); await db.update(supportTickets).set({ status: nextStatus!, updatedAt, resolvedAt: nextStatus === "resolved" ? updatedAt : null }).where(eq(supportTickets.ticketNumber, ticketNumber)); return Response.json({ ok: true, ticketNumber, status: nextStatus }); }
    if (body.action === "settings") {
      const current = await getSettings();
      const now = new Date();
      let recoveryAnnouncement: string | null = null;
      let recoveryExpiresAt: Date | null = null;
      if (body.testErrorCode === null && current.testErrorCode) {
        await db.update(errorTestHistory).set({ stoppedAt: now }).where(and(eq(errorTestHistory.code, current.testErrorCode), isNull(errorTestHistory.stoppedAt)));
        await db.update(announcementHistory).set({ revokedAt: now }).where(and(eq(announcementHistory.source, "auto"), isNull(announcementHistory.revokedAt)));
        recoveryAnnouncement = "服務已恢復正常，先前的錯誤已解除。感謝你的耐心等候。";
        recoveryExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await db.insert(announcementHistory).values({ message: recoveryAnnouncement, level: "info", source: "auto", expiresAt: recoveryExpiresAt });
      }
      const announcementChanged = body.announcement !== undefined && body.announcement !== current.announcement;
      if (announcementChanged && body.announcement) {
        await db.update(announcementHistory).set({ revokedAt: now }).where(isNull(announcementHistory.revokedAt));
        await db.insert(announcementHistory).values({ message: body.announcement.slice(0, 500), level: body.announcementLevel || current.announcementLevel, source: "manual", expiresAt: null });
      }
      if (announcementChanged && !body.announcement) await db.update(announcementHistory).set({ revokedAt: now }).where(isNull(announcementHistory.revokedAt));
      const nextAnnouncement = body.announcement !== undefined ? body.announcement.slice(0, 500) || null : recoveryAnnouncement ?? current.announcement;
      const nextAnnouncementLevel = body.announcement !== undefined ? (body.announcement ? body.announcementLevel || current.announcementLevel : "info") : recoveryAnnouncement ? "info" : current.announcementLevel;
      await db.update(systemSettings).set({ analysisEnabled: body.analysisEnabled ?? current.analysisEnabled, aiEnabled: body.aiEnabled ?? current.aiEnabled, sharingEnabled: body.sharingEnabled ?? current.sharingEnabled, announcement: nextAnnouncement, announcementLevel: nextAnnouncementLevel, announcementExpiresAt: body.announcement !== undefined && !body.announcement ? null : recoveryExpiresAt, testErrorCode: body.testErrorCode === undefined ? current.testErrorCode : body.testErrorCode, updatedAt: now }).where(eq(systemSettings.id, 1));
      return Response.json({ ok: true, settings: await getSettings() });
    }
    if (body.action === "simulate") {
      const code = body.eventType?.trim().toUpperCase(); if (!code || !/^[A-Z]+-\d{3}$/.test(code)) return errorResponse("ADMIN-004", "請選擇有效的錯誤代碼。", 400, "S2");
      if (!(code.startsWith("ANALYSIS-") || code.startsWith("AI-") || code.startsWith("SHARE-"))) return errorResponse("ADMIN-004", "此錯誤代碼尚未接入可測試的使用者服務流程。", 400, "S2");
      const info = errorInfo(code); const current = await getSettings(); const now = new Date();
      if (current.testErrorCode) await db.update(errorTestHistory).set({ stoppedAt: now }).where(and(eq(errorTestHistory.code, current.testErrorCode), isNull(errorTestHistory.stoppedAt)));
      await db.update(announcementHistory).set({ revokedAt: now }).where(and(eq(announcementHistory.source, "auto"), isNull(announcementHistory.revokedAt)));
      const announcement = publicTestAnnouncement(code);
      await db.update(systemSettings).set({ testErrorCode: code, announcement, announcementLevel: "warning", announcementExpiresAt: null, updatedAt: now }).where(eq(systemSettings.id, 1));
      await db.insert(errorTestHistory).values({ code, name: info.name, severity: info.severity, source: "test" });
      await db.insert(announcementHistory).values({ message: announcement, level: "warning", source: "auto" });
      return Response.json({ ok: true, simulated: code, name: info.name });
    }
    return errorResponse("ADMIN-005", "不支援的管理員操作。", 400, "S2");
  } catch (error) { console.error("[admin] database failure", error); return errorResponse("ADMIN-006", "管理員設定資料庫暫時無法使用。", 503, "S1"); }
}

export async function GET() {
  if (!(await isAdmin())) return errorResponse("ADMIN-002", "需要管理員登入才能查看後台。", 401, "S2");
  try {
    const settings = await getSettings();
    const totals = await db.select({ eventType: usageEvents.eventType, count: sql<number>`count(*)` }).from(usageEvents).groupBy(usageEvents.eventType);
    const recent = await db.select({ eventType: usageEvents.eventType, page: usageEvents.page, createdAt: usageEvents.createdAt }).from(usageEvents).orderBy(desc(usageEvents.createdAt)).limit(150);
    const activeRow = await db.select({ count: sql<number>`count(distinct ${usageEvents.sessionId})` }).from(usageEvents).where(gt(usageEvents.createdAt, sql`now() - interval '10 minutes'`));
    const testHistory = (await db.select().from(errorTestHistory).orderBy(desc(errorTestHistory.startedAt)).limit(150)).filter((item) => !item.code.startsWith("ADMIN-"));
    const announcementHistoryRows = await db.select().from(announcementHistory).orderBy(desc(announcementHistory.createdAt)).limit(100);
    const tickets = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(200);
    return Response.json({ settings, totals, recent, activeCount: Number(activeRow[0]?.count || 0), testHistory, announcementHistory: announcementHistoryRows, tickets });
  } catch (error) { console.error("[admin] read failure", error); return errorResponse("ADMIN-006", "管理員資料庫尚未建立或暫時無法使用。", 503, "S1"); }
}

function publicTestAnnouncement(code: string) {
  if (code.startsWith("AI-")) return "AI 分析服務目前暫時忙碌，請稍後再試。基本報告仍可繼續查看。";
  if (code.startsWith("SHARE-")) return "分享服務目前正在維護，暫時無法建立或查看分享連結，請稍後再試。";
  if (code.startsWith("FILE-")) return "檔案解析服務遇到問題，請確認檔案格式後稍後重新上傳。";
  if (code.startsWith("ANALYSIS-")) return "分析服務目前正在處理異常，請稍後重新開始分析。";
  return "部分服務目前暫時無法使用，我們正在處理，請稍後再試。";
}

async function getSettings() { const rows = await db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1); if (rows[0]) return rows[0]; await db.insert(systemSettings).values({ id: 1 }); const created = await db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1); return created[0]; }
