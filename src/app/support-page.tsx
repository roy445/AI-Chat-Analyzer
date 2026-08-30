"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, ExternalLink, LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { ERROR_CATALOG, errorInfo } from "@/lib/error-catalog";

const faq = [
  ["聊天檔案會被上傳嗎？", "基本解析在瀏覽器本機完成。只有你主動啟用 AI 或建立分享連結時，必要資料才會送到對應服務。"],
  ["支援哪些平台？", "目前支援 LINE TXT、Instagram JSON／部分 HTML，以及 Messenger JSON／部分 HTML。請從平台教學取得正確匯出檔。"],
  ["可以分析群組嗎？", "目前主要支援兩位聊天者。偵測到多人時會停止分析，避免把群組資料誤判成兩人互動。"],
  ["AI 深度分析會送出什麼？", "AI 會收到報告統計、聊天者姓名、互動訊號與事件摘要，不會收到原始檔案或完整訊息本文；啟用前會再次詢問你的同意。"],
  ["分享報告會保存什麼？", "分享只保存你選取的 sections，以及匿名／原名設定。原始聊天檔案不會保存；持有隨機分享連結的人可以查看已選內容。"],
  ["AI 額度用完怎麼辦？", "網站會優先嘗試主要 AI，遇到可恢復的忙碌或限流會重試並切換備援；兩者皆不可用時，基本本機分析仍可使用。"],
  ["如何回報錯誤？", "請前往錯誤回報頁，填入錯誤代碼、發生位置與描述。請不要貼上 API key、資料庫連線字串或完整聊天內容。"],
];

function SupportShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <main className="support-page"><div className="support-top"><Link className="btn-ghost" href="/"><ArrowLeft size={15} />回到首頁</Link><span className="status-pill"><ShieldCheck size={12} />AI Chat Analyzer</span></div><div className="support-hero"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>把重要資訊整理在一個清楚、容易查找的地方。</p></div><div className="support-content">{children}</div><footer className="support-footer"><span>© 2026 AI Chat Analyzer</span><span><Link href="/privacy">隱私政策</Link><span> · </span><Link href="/faq">常見問題</Link><span> · </span><Link href="/report-error">回報錯誤</Link></span></footer></main>;
}

export function PrivacyPage() {
  return <SupportShell title="隱私政策與資料使用說明" eyebrow="Privacy first"><div className="support-card"><h2>我們如何處理你的資料</h2><p>本工具以資料最小化與使用者主動同意為原則。你可以只使用本機分析，也可以個別選擇 AI 或分享功能。</p><div className="support-sections"><section><h3>1. 本機解析</h3><p>檔案讀取、格式解析、訊息統計、Emoji、文字、時間與基本互動分析都在目前裝置的瀏覽器中完成。選擇檔案不等於上傳檔案。</p></section><section><h3>2. AI 深度分析</h3><p>只有你在同意視窗按下確認後，報告統計、聊天者姓名、互動訊號與事件摘要才會傳送給 AI。原始聊天檔案與完整訊息本文不會送出。AI 分析不會匿名聊天者姓名。</p></section><section><h3>3. 分享與匿名</h3><p>建立分享前，你可以選擇要分享的資訊類別，以及匿名或保留原名。匿名模式會替換姓名，並同步處理可見的報告文字。只有已選取的內容會寫入分享資料庫。</p></section><section><h3>4. 保存期限與刪除</h3><p>原始聊天檔案不會由本工具保存。分享報告會保存在分享資料庫，直到系統管理者依保存政策移除；因為連結不需要登入，請不要分享給不信任的人。</p></section><section><h3>5. 你不應上傳的內容</h3><p>請不要上傳整個帳號備份、密碼、API key、資料庫連線字串、電話簿或與目標對話無關的私人資料。</p></section><section><h3>6. 分析限制</h3><p>聊天人格、情緒、衝突、主動程度與關係訊號都是根據可觀察文字與時間特徵做出的推測，不是心理診斷，也不代表對方真實想法。</p></section></div></div><div className="support-card support-callout"><LockKeyhole size={18} /><p>使用 AI 或建立分享連結前，系統會再次顯示資料使用方式。你可以隨時取消，不會影響本機基本分析。</p></div></SupportShell>;
}

export function FaqPage() {
  return <SupportShell title="常見問題" eyebrow="Questions answered"><div className="support-card"><div className="support-sections">{faq.map(([question, answer]) => <section key={question}><h3>{question}</h3><p>{answer}</p></section>)}</div></div><div className="support-card report-link-card"><CircleAlert size={18} /><div><h3>遇到錯誤了嗎？</h3><p>畫面上的錯誤代碼可以直接帶入回報表單，協助建立者快速定位問題。</p><Link className="btn-primary" href="/report-error">前往回報錯誤 <ExternalLink size={15} /></Link></div></div></SupportShell>;
}

export function ErrorReportPage() {
  const [code, setCode] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("code") || "");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState("report-error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const normalizedCode = code.trim().toUpperCase();
  const matched = ERROR_CATALOG.some((item) => item.code === normalizedCode);
  const info = errorInfo(normalizedCode);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setStatus(""); try { const response = await fetch("/api/error-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: normalizedCode, message, page, email }) }); const data = await response.json() as { error?: string; message?: string }; if (!response.ok) throw new Error(data.error || "回報送出失敗。"); setStatus(data.message || "已收到你的回報，謝謝你幫助我們改善。" ); setMessage(""); } catch (error) { setStatus(error instanceof Error ? error.message : "回報送出失敗，請稍後再試。" ); } finally { setBusy(false); } };
  return <SupportShell title="回報錯誤" eyebrow="Help us improve"><div className="support-card"><p>請填寫你在畫面上看到的錯誤代碼。輸入後，系統會自動帶出錯誤名稱；中文名稱不能自行修改，避免回報內容對不上。</p><form className="support-form" onSubmit={submit}><label>錯誤代碼<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="例如 AI-006" required /><small className="field-help">請輸入像 AI-006、SHARE-003 這種格式。</small></label><label>系統判別的錯誤名稱<input value={matched ? `${info.code}｜${info.name}` : normalizedCode ? "找不到此代碼，請確認是否輸入正確" : "輸入錯誤代碼後自動顯示"} readOnly aria-readonly="true" className={matched ? "field-readonly matched" : "field-readonly"} /><small className="field-help">這一欄由錯誤代碼自動產生，不能手動修改。</small></label><label>錯誤發生位置<select value={page} onChange={(event) => setPage(event.target.value)}><option value="home">首頁</option><option value="platform">選擇平台</option><option value="guide">匯出教學</option><option value="upload">上傳與檔案解析</option><option value="identify">確認聊天者</option><option value="report">分析報告</option><option value="ai">AI 深度分析</option><option value="share">建立或查看分享報告</option><option value="admin">管理員後台</option><option value="report-error">錯誤回報頁</option><option value="other">其他畫面</option></select><small className="field-help">這不是網址欄位；請選擇你看到錯誤的那個畫面。</small></label><label>聯絡信箱（選填）<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>問題描述<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="例如：我在分析報告按下 AI 深度分析後，畫面顯示什麼？是否重試過？" minLength={10} maxLength={2000} required /></label><button className="btn-primary" type="submit" disabled={busy || !matched}>{busy ? "正在送出…" : "送出錯誤回報"} <Send size={15} /></button>{status && <div className="notice" role="status">{status}</div>}</form></div><div className="support-card"><h2>隱私提醒</h2><p>請勿貼上完整聊天內容、密碼、API key、DATABASE_URL 或其他私人資料。錯誤回報只會寄送錯誤代碼、系統判別名稱、發生位置、描述與必要的技術摘要。</p></div></SupportShell>;
}
