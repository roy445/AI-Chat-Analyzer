import { NextResponse } from "next/server";
import { sendMail } from "@/lib/critical-notify";

const OWNER_EMAIL = "r03259468@gmail.com";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { code?: string; message?: string; page?: string; email?: string };
    const code = body.code?.trim().slice(0, 40).toUpperCase();
    const message = body.message?.trim().slice(0, 2000);
    const page = body.page?.trim().slice(0, 200);
    const email = body.email?.trim().slice(0, 200);
    if (!code || !message || message.length < 10) return NextResponse.json({ error: "請填寫錯誤代碼與至少 10 個字的問題描述。" }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "聯絡信箱格式不正確。" }, { status: 400 });
    if (!process.env.GMAIL_USER?.trim() || !process.env.GMAIL_APP_PASSWORD?.trim()) return NextResponse.json({ error: "Gmail SMTP 尚未設定，請稍後再試或直接提供錯誤代碼給建立者。" }, { status: 503 });
    const receivedAt = new Date().toISOString();
    const html = `<h2>AI Chat Analyzer 錯誤回報</h2><p><strong>錯誤代碼：</strong>${escapeHtml(code)}</p><p><strong>發生頁面：</strong>${escapeHtml(page || "未提供")}</p><p><strong>聯絡信箱：</strong>${escapeHtml(email || "未提供")}</p><p><strong>發生時間：</strong>${receivedAt}</p><hr /><p><strong>問題描述：</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>`;
    try { await sendMail({ subject: `[AI Chat Analyzer] ${code}`, html, replyTo: email || undefined }); } catch (error) { console.error("[error-report] gmail failed", error instanceof Error ? error.message : "unknown"); return NextResponse.json({ error: "Gmail 郵件寄送失敗，請稍後再試。" }, { status: 502 }); }
    return NextResponse.json({ message: "錯誤回報已送出，謝謝你幫助我們改善。" });
  } catch (error) { console.error("[error-report] request failed", error); return NextResponse.json({ error: "回報資料處理失敗，請稍後再試。" }, { status: 500 }); }
}

function escapeHtml(value: string) { return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] || character); }
