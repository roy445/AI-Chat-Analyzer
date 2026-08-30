import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { sharedReports } from "@/db/schema";

export const dynamic = "force-dynamic";

function isSafePayload(value: unknown): value is { report: unknown; ai?: unknown; mode?: "full" | "recap" | "achievements" } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const mode = record.mode;
  return Boolean(record.report) && (!mode || mode === "full" || mode === "recap" || mode === "achievements") && JSON.stringify(value).length < 900_000;
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isSafePayload(body)) return Response.json({ error: "分享內容格式不正確。" }, { status: 400 });
    const id = randomBytes(18).toString("base64url");
    await db.insert(sharedReports).values({ id, payload: body });
    return Response.json({ id });
  } catch {
    return Response.json({ error: "目前無法建立分享報告，請稍後再試。" }, { status: 500 });
  }
}
