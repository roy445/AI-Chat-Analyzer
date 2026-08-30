import { eq } from "drizzle-orm";
import { db } from "@/db";
import { systemSettings, usageEvents } from "@/db/schema";

export async function getSystemSettings() {
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
  return rows[0] || { id: 1, analysisEnabled: true, aiEnabled: true, sharingEnabled: true, announcement: null, announcementLevel: "info", testErrorCode: null, updatedAt: new Date() };
}
export async function recordUsage(eventType: "analysis" | "ai" | "share" | "file_parse") { try { await db.insert(usageEvents).values({ eventType }); } catch (error) { console.error("[usage] unable to record event", error); } }
