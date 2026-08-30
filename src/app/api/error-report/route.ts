import { NextResponse } from "next/server";

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
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "回報郵件服務尚未設定，請先將錯誤代碼與畫面截圖提供給建立者。" }, { status: 503 });
    const receivedAt = new Date().toISOString();
    const html = `<h2>AI Chat Analyzer 錯誤回報</h2><p><strong>錯誤代碼：</strong>${escapeHtml(code)}</p><p><strong>發生頁面：</strong>${escapeHtml(page || "未提供")}</p><p><strong>聯絡信箱：</strong>${escapeHtml(email || "未提供")}</p><p><strong>發生時間：</strong>${receivedAt}</p><hr /><p><strong>問題描述：</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>`;
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.REPORT_EMAIL_FROM || "AI Chat Analyzer <onboarding@resend.dev>", to: [process.env.REPORT_EMAIL_TO || OWNER_EMAIL], subject: `[AI Chat Analyzer] ${code}`, html, ...(email ? { reply_to: email } : {}) }) });
    if (!response.ok) { console.error("[error-report] email provider failed", response.status); return NextResponse.json({ error: "郵件寄送失敗，請稍後再試。" }, { status: 502 }); }
    return NextResponse.json({ message: "錯誤回報已送出，謝謝你幫助我們改善。" });
  } catch (error) { console.error("[error-report] request failed", error); return NextResponse.json({ error: "回報資料處理失敗，請稍後再試。" }, { status: 500 }); }
}

function escapeHtml(value: string) { return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] || character); }
