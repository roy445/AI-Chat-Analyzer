import { createHash } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { feedbackSubmissions } from "@/db/schema";
import { sendMail } from "@/lib/critical-notify";
import { errorInfo } from "@/lib/error-catalog";

const FEEDBACK_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { type?: string; code?: string; message?: string; page?: string; email?: string; clientId?: string };
    const type = ["error", "suggestion", "question"].includes(body.type || "") ? body.type! : "error";
    const code = body.code?.trim().slice(0, 40).toUpperCase() || "USER-自由回報";
    const message = body.message?.trim().slice(0, 3000);
    const page = body.page?.trim().slice(0, 200);
    const email = body.email?.trim().slice(0, 200);
    if (!message || message.length < 10) return NextResponse.json({ error: "請至少填寫 10 個字，讓我們了解你的問題或建議。" }, { status: 400 });
    if (type === "error" && !body.code?.trim()) return NextResponse.json({ error: "錯誤回報必須填寫錯誤代碼；若沒有代碼，請改選「使用問題」。" }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "聯絡信箱格式不正確。" }, { status: 400 });
    if (type !== "error") {
      if (!body.clientId?.trim()) return NextResponse.json({ error: "無法辨識此次匿名回報，請重新載入頁面後再試。" }, { status: 400 });
      const fingerprint = createHash("sha256").update(body.clientId.trim().slice(0, 120)).digest("hex");
      const cutoff = new Date(Date.now() - FEEDBACK_COOLDOWN_MS);
      const previous = await db.select({ createdAt: feedbackSubmissions.createdAt }).from(feedbackSubmissions).where(and(eq(feedbackSubmissions.fingerprint, fingerprint), gt(feedbackSubmissions.createdAt, cutoff))).orderBy(desc(feedbackSubmissions.createdAt)).limit(1);
      if (previous[0]) { const nextAllowedAt = new Date(previous[0].createdAt.getTime() + FEEDBACK_COOLDOWN_MS); return NextResponse.json({ error: "建議與使用問題每 3 天只能送出一次。錯誤回報不受此限制。", nextAllowedAt: nextAllowedAt.toISOString() }, { status: 429 }); }
      await db.insert(feedbackSubmissions).values({ fingerprint });
    }
    if (!process.env.GMAIL_USER?.trim() || !process.env.GMAIL_APP_PASSWORD?.trim()) return NextResponse.json({ error: "Gmail SMTP 尚未設定，請稍後再試或直接提供內容給建立者。" }, { status: 503 });
    const receivedAt = new Date().toISOString();
    const known = !code.startsWith("USER-") ? errorInfo(code) : null;
    const typeName = type === "suggestion" ? "功能建議" : type === "question" ? "使用問題" : "錯誤回報";
    const html = `<h2>AI Chat Analyzer ${typeName}</h2><p><strong>回報類型：</strong>${escapeHtml(typeName)}</p><p><strong>錯誤代碼：</strong>${escapeHtml(code)}</p>${known ? `<p><strong>系統判別名稱：</strong>${escapeHtml(known.name)}</p>` : ""}<p><strong>發生位置：</strong>${escapeHtml(page || "未指定")}</p><p><strong>聯絡信箱：</strong>${escapeHtml(email || "未提供")}</p><p><strong>發生時間：</strong>${receivedAt}</p><hr /><p><strong>內容：</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>`;
    try { await sendMail({ subject: `[AI Chat Analyzer][${typeName}] ${code}`, html, replyTo: email || undefined }); } catch (error) { console.error("[error-report] gmail failed", error instanceof Error ? error.message : "unknown"); return NextResponse.json({ error: "Gmail 郵件寄送失敗，請稍後再試。" }, { status: 502 }); }
    return NextResponse.json({ message: `${typeName}已送出，謝謝你幫助我們改善。` });
  } catch (error) { console.error("[error-report] request failed", error); return NextResponse.json({ error: "回報資料處理失敗，請稍後再試。" }, { status: 500 }); }
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] || character); }
