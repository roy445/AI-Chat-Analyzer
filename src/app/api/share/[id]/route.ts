import { db } from "@/db";
import { sharedReports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/errors";
import { getSystemSettings, recordUsage } from "@/lib/service-control";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const settings = await getSystemSettings();
    if (!settings.sharingEnabled) return errorResponse("SHARE-009", "分享服務目前由管理員暫停，請稍後再試。", 503, "S1");
    if (settings.testErrorCode?.startsWith("SHARE-")) return errorResponse(settings.testErrorCode, "分享服務目前暫時無法使用，請稍後再試。", 503, "S1");
    const { id } = await params;
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(id)) return Response.json({ error: "找不到這份分享報告。" }, { status: 404 });
    const [row] = await db.select({ payload: sharedReports.payload, createdAt: sharedReports.createdAt }).from(sharedReports).where(eq(sharedReports.id, id)).limit(1);
    if (!row) return Response.json({ error: "找不到這份分享報告，連結可能已失效。" }, { status: 404 });
    await recordUsage("share_view");
    return Response.json({ ...row.payload as object, createdAt: row.createdAt });
  } catch (error) {
    console.error("[share/view] failure", error);
    return errorResponse("SHARE-009", "目前無法讀取這份分享報告。", 500, "S1");
  }
}
