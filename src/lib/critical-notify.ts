const OWNER_EMAIL = "r03259468@gmail.com";

export function notifyCritical(code: string, detail: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return;
  const safeDetail = detail.slice(0, 1200).replace(/[<>]/g, "");
  void fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.REPORT_EMAIL_FROM || "AI Chat Analyzer <onboarding@resend.dev>", to: [process.env.REPORT_EMAIL_TO || OWNER_EMAIL], subject: `[CRITICAL ${code}] AI Chat Analyzer`, html: `<h2>高嚴重度錯誤通知</h2><p><strong>錯誤代碼：</strong>${code}</p><p><strong>時間：</strong>${new Date().toISOString()}</p><p><strong>安全摘要：</strong>${safeDetail}</p><p>請前往 Vercel Function Logs 查看完整但不公開的錯誤紀錄。</p>` }) }).catch((error) => console.error("[critical-notify] failed", error));
}
