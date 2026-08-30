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
  } catch (error) {
    const dbError = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    const cause = dbError.cause ?? dbError;
    const code = cause.code || dbError.code || "UNKNOWN";
    const detail = cause.message || dbError.message || "";
    console.error("[share] database failure", code, detail);
    if (code === "42P01") return Response.json({ error: "分享資料表尚未建立，請先執行 Drizzle migration／push，再重新部署。" }, { status: 500 });
    if (code === "28P01" || code === "3D000") return Response.json({ error: "資料庫帳號或資料庫名稱無效，請檢查 Vercel 的 DATABASE_URL。" }, { status: 500 });
    if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "08001") return Response.json({ error: "無法連線到 PostgreSQL，請檢查 DATABASE_URL、SSL 設定與資料庫是否允許外部連線。" }, { status: 500 });
    return Response.json({ error: "目前無法建立分享報告，請查看 Vercel Function Logs 的 [share] database failure 詳細錯誤。" }, { status: 500 });
  }
}
