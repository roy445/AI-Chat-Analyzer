import nodemailer from "nodemailer";

const OWNER_EMAIL = "r03259468@gmail.com";

function mailer() {
  const user = process.env.GMAIL_USER?.trim();
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "").trim();
  if (!user || !password) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass: password } });
}

export async function sendMail(options: { subject: string; html: string; replyTo?: string }) {
  const transport = mailer();
  if (!transport) throw new Error("MAIL_NOT_CONFIGURED");
  await transport.sendMail({ from: `AI Chat Analyzer <${process.env.GMAIL_USER}>`, to: process.env.REPORT_EMAIL_TO?.trim() || OWNER_EMAIL, replyTo: options.replyTo, subject: options.subject, html: options.html });
}

export function notifyCritical(code: string, detail: string) {
  const safeDetail = detail.slice(0, 1200).replace(/[<>]/g, "");
  void sendMail({ subject: `[CRITICAL ${code}] AI Chat Analyzer`, html: `<h2>高嚴重度錯誤通知</h2><p><strong>錯誤代碼：</strong>${code}</p><p><strong>時間：</strong>${new Date().toISOString()}</p><p><strong>安全摘要：</strong>${safeDetail}</p><p>請前往 Vercel Function Logs 查看完整但不公開的錯誤紀錄。</p>` }).catch((error) => console.error("[critical-notify] failed", error instanceof Error ? error.message : "unknown"));
}
