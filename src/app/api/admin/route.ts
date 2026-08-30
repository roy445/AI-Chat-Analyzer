import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { systemSettings, usageEvents } from "@/db/schema";
import { clearAdminCookie, isAdmin, setAdminCookie, validPassword } from "@/lib/admin-auth";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { action?: string; password?: string; analysisEnabled?: boolean; aiEnabled?: boolean; sharingEnabled?: boolean; announcement?: string; announcementLevel?: string; testErrorCode?: string | null; eventType?: string };
  if (body.action === "login") { if (!validPassword(body.password || "")) return errorResponse("ADMIN-001", "管理員密碼不正確或尚未設定。", 401, "S1"); const response = Response.json({ ok: true }); setAdminCookie(response); return response; }
  if (body.action === "logout") { const response = Response.json({ ok: true }); clearAdminCookie(response); return response; }
  if (!(await isAdmin())) return errorResponse("ADMIN-002", "需要管理員登入才能執行這個操作。", 401, "S2");
  try {
    if (body.action === "log") { if (!["analysis", "ai", "share", "file_parse"].includes(body.eventType || "")) return errorResponse("ADMIN-003", "不支援的使用事件類型。", 400, "S2"); await db.insert(usageEvents).values({ eventType: body.eventType! }); return Response.json({ ok: true }); }
    if (body.action === "settings") { const current = await getSettings(); await db.update(systemSettings).set({ analysisEnabled: body.analysisEnabled ?? current.analysisEnabled, aiEnabled: body.aiEnabled ?? current.aiEnabled, sharingEnabled: body.sharingEnabled ?? current.sharingEnabled, announcement: body.announcement?.slice(0, 500) ?? current.announcement, announcementLevel: body.announcementLevel || current.announcementLevel, testErrorCode: body.testErrorCode === undefined ? current.testErrorCode : body.testErrorCode, updatedAt: new Date() }).where(eq(systemSettings.id, 1)); return Response.json({ ok: true, settings: await getSettings() }); }
    if (body.action === "simulate") { const code = body.eventType?.trim().toUpperCase(); if (!code || !/^[A-Z]+-\d{3}$/.test(code)) return errorResponse("ADMIN-004", "請選擇有效的錯誤代碼。", 400, "S2"); await db.update(systemSettings).set({ testErrorCode: code, updatedAt: new Date() }).where(eq(systemSettings.id, 1)); return Response.json({ ok: true, simulated: code }); }
    return errorResponse("ADMIN-005", "不支援的管理員操作。", 400, "S2");
  } catch (error) { console.error("[admin] database failure", error); return errorResponse("ADMIN-006", "管理員設定資料庫暫時無法使用。", 503, "S1"); }
}

export async function GET() {
  if (!(await isAdmin())) return errorResponse("ADMIN-002", "需要管理員登入才能查看後台。", 401, "S2");
  try { const settings = await getSettings(); const totals = await db.select({ eventType: usageEvents.eventType, count: sql<number>`count(*)` }).from(usageEvents).groupBy(usageEvents.eventType); const recent = await db.select({ eventType: usageEvents.eventType, createdAt: usageEvents.createdAt }).from(usageEvents).orderBy(desc(usageEvents.createdAt)).limit(100); return Response.json({ settings, totals, recent }); } catch (error) { console.error("[admin] read failure", error); return errorResponse("ADMIN-006", "管理員資料庫尚未建立或暫時無法使用。", 503, "S1"); }
}

async function getSettings() { const rows = await db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1); if (rows[0]) return rows[0]; await db.insert(systemSettings).values({ id: 1 }); const created = await db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1); return created[0]; }
