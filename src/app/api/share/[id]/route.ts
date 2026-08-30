import { db } from "@/db";
import { sharedReports } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(id)) return Response.json({ error: "找不到這份分享報告。" }, { status: 404 });
    const [row] = await db.select({ payload: sharedReports.payload, createdAt: sharedReports.createdAt }).from(sharedReports).where(eq(sharedReports.id, id)).limit(1);
    if (!row) return Response.json({ error: "找不到這份分享報告，連結可能已失效。" }, { status: 404 });
    return Response.json({ ...row.payload as object, createdAt: row.createdAt });
  } catch {
    return Response.json({ error: "目前無法讀取這份分享報告。" }, { status: 500 });
  }
}
