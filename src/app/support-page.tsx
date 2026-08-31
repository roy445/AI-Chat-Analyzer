"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, ExternalLink, LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { ERROR_CATALOG, errorInfo } from "@/lib/error-catalog";

const faq = [
  ["聊天檔案會被上傳嗎？", "基本解析、統計與圖表整理都在目前裝置的瀏覽器中完成。選擇檔案不等於上傳檔案；只有你主動確認 AI 或分享時，必要資料才會送出。"],
  ["支援哪些平台與檔案格式？", "目前支援 LINE TXT、Instagram JSON／部分 HTML，以及 Messenger JSON／部分 HTML。不同平台匯出格式會變動，請依平台教學下載正確的聊天檔。"],
  ["為什麼檔案明明是 JSON 卻無法分析？", "JSON 可能是帳號設定、聯絡人、索引或整個帳號摘要，而不是含有訊息陣列的聊天檔。請確認檔案含有 messages、sender_name、timestamp_ms 或相近欄位。"],
  ["可以上傳 ZIP 或整個帳號備份嗎？", "不建議。請先在本機解壓縮，只選擇單一目標對話檔案，避免把其他聊天、聯絡人或私人設定一起交給解析器。"],
  ["可以分析群組嗎？", "目前主要支援兩位聊天者。偵測到多人時會停止或提醒，避免把群組訊息誤判成兩人互動。"],
  ["為什麼中文變成亂碼？", "通常是匯出檔案的編碼與瀏覽器偵測結果不一致，或檔案本身已經損壞。請重新下載原始檔，避免用不支援 UTF-8 的工具另存。"],
  ["檔案太大或解析很慢怎麼辦？", "大型檔案會受到瀏覽器記憶體與裝置效能限制。可先確認是否選錯整個帳號備份，或拆分成較小的單一對話檔案。"],
  ["日期、時間與時區會不會錯？", "報告會依匯出資料提供的時間欄位計算；若原始檔缺少時區或時間不完整，資料品質區會提醒可能存在誤差。"],
  ["為什麼找不到聊天者姓名？", "檔案可能沒有保留發送者欄位，或該平台使用不同欄位名稱。解析器會盡可能辨識，無法確認時會要求你在確認頁補充。"],
  ["本機分析包含哪些內容？", "包含訊息量、日期範圍、活躍時段、回覆速度、互動平衡、沉默區間、常見詞彙、情緒趨勢與其他可由資料觀察的統計。"],
  ["報告中的聊天人格是心理診斷嗎？", "不是。人格、情緒、衝突與關係訊號都是依文字和時間特徵產生的推測，不代表對方真實想法，也不能取代專業心理或醫療評估。"],
  ["AI 深度分析會送出什麼？", "只有在你確認後，報告統計、聊天者姓名、互動訊號與事件摘要才會送到 AI。原始檔案與完整訊息本文不會送出；AI 分析不會預設匿名姓名。"],
  ["AI 分析為什麼失敗或顯示 503？", "可能是模型繁忙、額度用完、網路逾時、請求格式不相容或外部服務暫時不可用。系統會嘗試備援；本機報告仍可繼續查看。"],
  ["AI 額度用完怎麼辦？", "網站會優先嘗試主要服務，遇到可恢復的忙碌或限流會重試並切換備援；兩者皆不可用時，基本本機分析仍可使用。"],
  ["可以不要使用 AI 嗎？", "可以。本機分析不需要 AI key，也不會因為你拒絕 AI 而無法查看基本報告。"],
  ["分享報告會保存什麼？", "只會保存你選取的報告區塊與匿名／原名設定。原始聊天檔案不會保存；持有隨機分享連結的人可以查看已選內容。"],
  ["分享時可以只選某些內容嗎？", "可以。建立分享前可個別選擇總覽、互動、趨勢、文字、事件、成就、年度回顧與 AI 報告等區塊。未勾選的區塊不會寫入分享資料。"],
  ["分享時可以匿名嗎？", "可以。匿名模式會把聊天者姓名替換為 PERSON_A／PERSON_B，並同步處理報告中可見的姓名文字。"],
  ["分享連結需要登入嗎？", "目前不需要。隨機連結持有人即可查看已分享內容，因此請只把連結傳給信任的人。"],
  ["分享報告能不能刪除？", "目前分享報告由系統依保存政策管理；請妥善保管連結。若需要移除特定內容，請透過錯誤回報頁提供分享連結與原因。"],
  ["列印或另存 PDF 會包含哪些內容？", "列印會依你選擇的列印區塊產生報告，並隱藏操作按鈕、分享設定與管理控制。請在列印預覽確認內容後再儲存。"],
  ["手機、平板和電腦的版面一樣嗎？", "內容相同，但網站會依可用寬度自動調整欄數、字體、按鈕、報告側欄與卡片排列；手機上的報告導覽可以橫向滑動。"],
  ["為什麼 Instagram 圖示有時比較晚出現？", "平台圖示會使用本機靜態資源載入，若第一次開啟仍出現延遲，通常是瀏覽器快取或網路載入造成；重新開啟後通常會改善。"],
  ["錯誤代碼代表什麼？", "錯誤代碼用來協助定位問題，例如 FILE 代表檔案、AI 代表 AI 服務、SHARE 代表分享、GIT 代表版本控制、DEPLOY 代表部署。完整清單可在錯誤代碼文件查看。"],
  ["看到沒有收錄的錯誤代碼怎麼辦？", "仍然可以前往回報頁。錯誤回報不限次數；代碼可以直接貼上，或留白後用文字描述，建立者會人工確認。"],
  ["錯誤回報需要填什麼？", "請提供你看到的代碼、錯誤發生位置、做了什麼操作、畫面顯示內容與是否能重現。不要附上密碼、API key、DATABASE_URL 或完整聊天內容。"],
  ["功能建議可以送幾次？", "功能建議與使用問題每個匿名瀏覽器識別每 3 天一次；真正的錯誤回報不受限制，可以隨時送出。"],
  ["我只是有問題，不知道是不是錯誤，可以詢問嗎？", "可以。回報頁提供「使用問題」類型，你可以不用錯誤代碼，直接描述想完成的事情和卡住的步驟。"],
  ["網站會保存我的姓名、IP 或聊天內容嗎？", "本機分析不會把原始聊天檔案送到伺服器。服務使用紀錄以匿名事件與工作階段識別為主；詳細資料使用方式請查看隱私政策。"],
  ["為什麼頁面顯示服務公告？", "當管理員發布維護通知，或系統偵測到重大服務錯誤時，前台會顯示公告。公告會定期自動更新，不需要手動刷新。"],
  ["分析動畫為什麼至少需要幾秒？", "動畫用來清楚呈現讀取、整理、分析與完成階段，避免使用者誤以為頁面沒有反應；並不代表檔案會被上傳或處理時間固定。"],
  ["我可以在不同裝置繼續同一份本機分析嗎？", "本機分析資料留在目前瀏覽器記憶體，重新整理或換裝置後通常需要重新選擇檔案。分享連結則可在其他裝置查看已分享內容。"],
];

function SupportShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <main className="support-page"><div className="support-top"><Link className="btn-ghost" href="/"><ArrowLeft size={15} />回到首頁</Link><span className="status-pill"><ShieldCheck size={12} />AI Chat Analyzer</span></div><div className="support-hero"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>把重要資訊整理在一個清楚、容易查找的地方。</p></div><div className="support-content">{children}</div><footer className="support-footer"><span>© 2026 AI Chat Analyzer</span><span><Link href="/privacy">隱私政策</Link><span> · </span><Link href="/faq">常見問題</Link><span> · </span><Link href="/report-error">回報錯誤</Link></span></footer></main>;
}

export function PrivacyPage() {
  return <SupportShell title="隱私政策與資料使用條款" eyebrow="Privacy first"><div className="support-card"><h2>一、政策目的與適用範圍</h2><p>本政策說明 AI Chat Analyzer 如何處理你在使用聊天分析、AI 深度分析、分享報告、錯誤回報與網站瀏覽功能時產生的資料。我們採取資料最小化、目的限定、透明告知與使用者主動同意的原則。你可以只使用本機分析，也可以逐項選擇是否啟用 AI 或分享。</p><div className="support-sections"><section><h3>二、我們可能處理的資料</h3><p>依你實際使用的功能，資料可能包括聊天匯出檔中的發送者名稱、訊息時間、文字統計、附件類型、Emoji 統計、日期區間與互動指標；AI 功能可能收到報告統計、聊天者姓名、互動訊號與事件摘要；分享功能只會保存你選取的報告區塊與匿名設定。</p></section><section><h3>三、本機解析與基本分析</h3><p>檔案選擇、格式解析、訊息統計與基本報告主要在目前裝置的瀏覽器中完成。選擇檔案不等於上傳檔案。原始聊天檔案不會因為你使用本機分析而自動傳到我們的伺服器；重新整理或關閉頁面後，本機暫存的分析狀態可能消失。</p></section><section><h3>四、AI 深度分析與同意</h3><p>只有你在同意提示中確認後，必要的報告摘要才會送往 AI 服務。原始聊天檔案與完整訊息本文不會送出，但報告摘要仍可能包含聊天者姓名或由文字推導的互動訊號。AI 產生的內容是推測與整理，不是心理診斷、事實認定或對任何人的人格定論。</p></section><section><h3>五、分享報告與匿名選項</h3><p>建立分享前，你可以逐項選擇要公開的總覽、互動、趨勢、文字、事件、成就、年度回顧或 AI 內容，也可以選擇保留原名或使用匿名名稱。匿名模式會以 PERSON_A／PERSON_B 取代可見姓名。持有隨機分享連結的人可能查看已選內容，因此請只分享給信任的人。</p></section><section><h3>六、錯誤回報、建議與使用問題</h3><p>錯誤回報會寄送你填寫的代碼、系統判別名稱、發生位置、問題描述、提交時間與選填信箱。功能建議與使用問題也會寄送相應內容；這些表單不會自動附加聊天檔、完整訊息、密碼、API key 或資料庫連線字串。錯誤回報不限次數，建議與使用問題則每個匿名瀏覽器識別每三天一次。</p></section><section><h3>七、匿名使用紀錄</h3><p>為了了解服務是否正常，我們可能記錄匿名事件類型、時間、頁面來源與暫時性的匿名工作階段識別，用來估算活躍人數、分析功能使用量、診斷錯誤與改善介面。我們不以此資料建立姓名檔案，也不主動記錄 IP 作為使用者識別。</p></section><section><h3>八、資料保存與刪除</h3><p>原始聊天檔案不由本工具保存。分享報告、錯誤紀錄、公告歷史與匿名使用事件會依服務維運所需保存，並由管理者依資料庫保存政策移除。由於分享連結可能不需要登入，請不要把敏感內容放入分享報告；如需協助移除分享內容，請透過錯誤回報頁提供可辨識的分享連結。</p></section><section><h3>九、第三方服務</h3><p>AI 深度分析可能使用 Gemini 或 OpenRouter 等外部 AI 服務；錯誤回報可能透過 Gmail SMTP 寄送給維護者；分享報告與維運資料可能儲存在部署使用的 PostgreSQL 資料庫。第三方服務的處理會受其自身條款與隱私政策約束，我們只在你啟用相應功能時傳送必要資料。</p></section><section><h3>十、資訊安全與限制</h3><p>我們會採取存取控制、HttpOnly 管理員 Cookie、避免在前端暴露 API key、錯誤訊息遮蔽敏感設定等措施。然而，網路傳輸、瀏覽器、第三方服務與使用者自行分享連結仍可能帶來風險，不能保證絕對安全。請勿上傳密碼、API key、DATABASE_URL、整個帳號備份、電話簿或與分析無關的私人資料。</p></section><section><h3>十一、未成年使用與他人資料</h3><p>請在你有權使用的資料範圍內進行分析，並在分享或送出 AI 前確認你有適當權限。若內容涉及他人私人對話，請尊重對方的合理隱私期待，不要在未經允許下公開分享敏感內容。</p></section><section><h3>十二、政策變更與聯絡方式</h3><p>功能、第三方服務與保存方式可能改變；重大變更會透過網站公告或更新本頁通知。若你發現資料處理問題、想詢問資料使用方式或需要協助，請使用錯誤回報頁的「使用問題」類型，並避免在表單中貼上敏感資料。</p></section></div></div><div className="support-card support-callout"><LockKeyhole size={18} /><div><h2>使用前的重要提醒</h2><p>使用 AI 或建立分享連結前，系統會再次顯示資料使用方式。你可以拒絕 AI、取消分享或只使用本機基本分析；拒絕非必要功能不會影響本機報告。</p><p>本頁為產品資料使用說明，不取代你所在地適用的法律、平台條款或專業法律意見。</p></div></div></SupportShell>;
}

export function FaqPage() {
  return <SupportShell title="常見問題" eyebrow="Questions answered"><div className="support-card"><div className="support-sections">{faq.map(([question, answer]) => <section key={question}><h3>{question}</h3><p>{answer}</p></section>)}</div></div><div className="support-card report-link-card"><CircleAlert size={18} /><div><h3>遇到錯誤了嗎？</h3><p>畫面上的錯誤代碼可以直接帶入回報表單，協助建立者快速定位問題。</p><Link className="btn-primary" href="/report-error">前往回報錯誤 <ExternalLink size={15} /></Link></div></div></SupportShell>;
}

export function ErrorReportPage() {
  const [type, setType] = useState<"error" | "suggestion" | "question">("error");
  const [code, setCode] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("code") || "");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(() => typeof window === "undefined" ? "report-error" : new URLSearchParams(window.location.search).get("page") || "report-error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [clientId] = useState(() => { if (typeof window === "undefined") return ""; const key = "aca-feedback-id"; const existing = window.localStorage.getItem(key); if (existing) return existing; const created = crypto.randomUUID(); window.localStorage.setItem(key, created); return created; });
  const normalizedCode = code.trim().toUpperCase();
  const matched = ERROR_CATALOG.some((item) => item.code === normalizedCode);
  const info = errorInfo(normalizedCode);
  const isError = type === "error";
  const submit = async (event: FormEvent) => { event.preventDefault(); if (isError && !normalizedCode) { setStatus("請填寫錯誤代碼；若沒有代碼，請改選「使用問題」描述情況。" ); return; } setBusy(true); setStatus(""); try { const response = await fetch("/api/error-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, code: normalizedCode, message, page, email, clientId }) }); const data = await response.json() as { error?: string; message?: string; ticketNumber?: string; nextAllowedAt?: string }; if (!response.ok) throw new Error(data.ticketNumber ? `${data.error || "案件已建立，但通知寄送失敗。"} 案件單號：${data.ticketNumber}` : data.nextAllowedAt ? `${data.error} 下次可提交時間：${new Date(data.nextAllowedAt).toLocaleString("zh-TW")}` : data.error || "送出失敗。"); setStatus(`${data.message || "已收到你的內容，謝謝你幫助我們改善。"} 案件單號：${data.ticketNumber || "已建立"}，請保存此單號方便查詢。`); setMessage(""); } catch (error) { setStatus(error instanceof Error ? error.message : "送出失敗，請稍後再試。" ); } finally { setBusy(false); } };
  return <SupportShell title="回報錯誤與提供回饋" eyebrow="Help us improve"><div className="support-card"><p>不知道錯誤代碼也沒關係。你可以選擇回報類型，照著提示自由描述；如果是系統錯誤，請把畫面上看到的代碼貼上，系統會自動判別名稱。</p><form className="support-form" onSubmit={submit}><label>你想提供什麼？<select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="error">回報錯誤（不限次數）</option><option value="suggestion">提出功能建議（每 3 天一次）</option><option value="question">提出使用問題（每 3 天一次）</option></select><small className="field-help">錯誤回報不限次數；建議與使用問題為每個瀏覽器識別每 3 天一次。</small></label>{isError ? <><label>錯誤代碼（必填）<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="例如 AI-006" /><small className="field-help">請複製錯誤畫面上的代碼；沒收錄的代碼也可以直接貼上。若完全沒有代碼，請改選「使用問題」。</small></label><label>系統判別的錯誤名稱<input value={matched ? `${info.code}｜${info.name}` : normalizedCode ? "未收錄代碼：將由建立者人工確認" : "請先填寫錯誤代碼"} readOnly aria-readonly="true" className={matched ? "field-readonly matched" : "field-readonly"} /><small className="field-help">這一欄由系統自動產生，不能手動修改；未知代碼不會被誤分類。</small></label></> : null}<label>錯誤或回饋發生位置<select value={page} onChange={(event) => setPage(event.target.value)}><option value="home">首頁</option><option value="platform">選擇平台</option><option value="guide">匯出教學</option><option value="upload">上傳與檔案解析</option><option value="identify">確認聊天者</option><option value="report">分析報告</option><option value="ai">AI 深度分析</option><option value="share">建立或查看分享報告</option><option value="admin">管理員後台</option><option value="report-error">錯誤回報頁</option><option value="other">其他畫面</option></select><small className="field-help">這不是網址欄位；請選擇你看到問題或想提出建議的畫面。</small></label><label>聯絡信箱（選填）<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com，方便我們回覆時再填" /></label><label>{type === "error" ? "請描述錯誤" : type === "suggestion" ? "請描述你的建議" : "請描述你遇到的問題"}<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={type === "error" ? "例如：我在分析報告按下 AI 深度分析後，看到什麼訊息？是否重試過？不知道代碼也可以直接描述。" : type === "suggestion" ? "例如：希望報告可以增加哪些功能？你會怎麼使用？" : "例如：你想完成什麼操作？卡在哪一步？畫面出現什麼？"} minLength={10} maxLength={3000} required /></label><button className="btn-primary" type="submit" disabled={busy || (isError && !normalizedCode)}>{busy ? "正在送出…" : type === "error" ? "送出錯誤回報" : type === "suggestion" ? "送出功能建議" : "送出使用問題"} <Send size={15} /></button>{status && <div className="notice" role="status">{status}</div>}</form></div><div className="support-card"><h2>送出前提醒</h2><p>請勿貼上完整聊天內容、密碼、API key、DATABASE_URL 或其他私人資料。功能建議與使用問題為了避免重複垃圾訊息，每 3 天限送一次；真正的錯誤回報永遠可以再次送出。</p></div></SupportShell>;
}
