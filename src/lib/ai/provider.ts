import type { AiAnalysis, AnalysisReport } from "@/lib/chat/types";

export type AiProvider = {
  name: string;
  analyze(input: string): Promise<AiAnalysis>;
};

function safeFallback(report: AnalysisReport): AiAnalysis {
  const initiative = report.initiative.me >= report.initiative.them ? "你在可觀察的互動中比較常把話題往前推" : "對方在可觀察的互動中比較常把話題往前推";
  const topic = report.topics[0]?.name ? `你們最常碰到的主題之一是「${report.topics[0].name}」` : "目前沒有足夠文字可以整理出穩定的主題";
  return {
    provider: "local-summary",
    confidence: report.quality.hasEnoughText ? 68 : 42,
    summary: `${initiative}。${topic}。整體來看，這是一段可以從節奏、話題與回覆習慣觀察出特色的聊天。`,
    atmosphere: report.emoji.total > 10 ? "互動裡有不少輕鬆語氣訊號，但情緒仍不能只靠 Emoji 判定。" : "聊天裡的情緒訊號有限，建議把這份報告當成觀察工具，而不是關係結論。",
    observations: [
      `訊息量較高的一方是${report.overview.myMessages >= report.overview.theirMessages ? "你" : "對方"}，比例約 ${Math.round((Math.max(report.overview.myMessages, report.overview.theirMessages) / report.overview.total) * 100)}%。`,
      report.events.some((event) => event.type === "conflict") ? "紀錄中有一段互動出現疑似語氣轉折，後續仍需要以完整上下文理解。" : "目前沒有足夠連續訊號標記疑似衝突事件。",
      `最常使用的 Emoji 是 ${report.emoji.byEmoji[0]?.emoji ?? "—"}，它只代表使用習慣，不代表固定情緒。`,
    ],
    cautions: ["這是根據聊天紀錄的推測，不代表任何一方的真實想法。", "沒有訊息不等於已讀，也不代表對方當下的情緒或意圖。"],
    keyFindings: [initiative, topic, `這份紀錄共包含 ${report.overview.total.toLocaleString()} 則訊息，涵蓋 ${report.overview.durationDays} 天。`, `最活躍時段集中在 ${report.overview.activeHour}。`, `最活躍日期是 ${report.overview.activeDate}。`, `資料品質為「${report.quality.confidence}」，請搭配資料品質頁一起閱讀。`],
    communicationStyle: [`訊息量分布為你 ${report.overview.myMessages.toLocaleString()} 則、對方 ${report.overview.theirMessages.toLocaleString()} 則。`, `你的回覆中位數約 ${report.response.me.median || 0} 分鐘，對方約 ${report.response.them.median || 0} 分鐘。`, `主動程度分布為你 ${report.initiative.me}%、對方 ${report.initiative.them}%。`, `最常使用的詞語與 Emoji 反映的是聊天習慣，不等於固定個性。`, "對話節奏應搭配日期範圍與資料完整度判讀。"],
    emotionalSignals: [report.emoji.total > 10 ? `紀錄中共出現 ${report.emoji.total} 個 Emoji，顯示文字以外存在語氣訊號。` : "Emoji 訊號較少，無法只靠 Emoji 推斷情緒。", report.events.some((event) => event.type === "conflict") ? "事件資料中出現疑似語氣轉折，仍需要完整上下文確認。" : "目前沒有足夠連續訊號標記疑似衝突。", "情緒趨勢只描述文字訊號，不能代表對方真實感受。", `最常見的 Emoji 是 ${report.emoji.byEmoji[0]?.emoji ?? "—"}。`, "沒有訊息的時段不代表冷淡、已讀或特定意圖。"],
    strengths: ["雙方都在這段紀錄中留下可分析的互動訊號。", `聊天最活躍時段為 ${report.overview.activeHour}，代表部分互動具有穩定時間分布。`, `目前已整理出 ${report.topics.length} 個文字主題，可作為回顧對話的入口。`, "報告同時提供客觀統計與推測型指標，方便交叉閱讀。"],
    frictionPoints: [report.events.some((event) => event.type === "conflict") ? "疑似衝突事件需要回到原始上下文核對，不能只看標籤。" : "目前沒有足夠資料支持明確的衝突結論。", `最長沉默約 ${report.v2.silence.longest.hours.toFixed(1)} 小時，應先確認資料是否完整。`, "回覆速度差異可能受到工作、睡眠與時區影響。", "詞頻與訊息量差異不能單獨解讀成關係中的優劣。"],
    actionableSuggestions: ["先用時間範圍篩選功能比較不同期間，不要把整段紀錄視為單一狀態。", "查看原始對話上下文，再判斷疑似事件是否符合你的實際記憶。", "把高頻主題當作開啟對話的線索，而不是對彼此貼標籤。", "若要分享，建議只選擇必要類別並優先使用匿名模式。", "定期重新分析新增紀錄，觀察變化而不是只看單次分數。"],
    evidence: [report.initiative.basis[0] ?? "主動程度由對話開啟與互動行為計算。", `訊息總量：${report.overview.total.toLocaleString()} 則。`, `日期範圍：${report.overview.startDate} 至 ${report.overview.endDate}。`, `最常聊天時段：${report.overview.activeHour}。`, `最常使用 Emoji：${report.emoji.byEmoji[0]?.emoji ?? "—"}。`, `資料品質：${report.quality.note}`],
  };
}

const SYSTEM_PROMPT = "你是繁體中文聊天互動分析助手。只能根據輸入的匿名化統計與摘要回答，不可臆測未提供的內容，不可診斷心理，不可判定喜歡或討厭。每項推測使用可能、疑似、從聊天紀錄來看。請做超詳細但清楚的分析，抓出所有可由資料支持的重點，避免空泛重複。只輸出有效 JSON，不要 Markdown code fence。JSON keys: summary(string), atmosphere(string), observations(string[] 至少 8 項), cautions(string[]), confidence(number 0-100), provider(string), keyFindings(string[] 至少 6 項), communicationStyle(string[] 至少 5 項), emotionalSignals(string[] 至少 5 項), strengths(string[] 至少 4 項), frictionPoints(string[] 至少 4 項), actionableSuggestions(string[] 至少 5 項), evidence(string[] 至少 6 項)。每個陣列項目都要是完整句子，並引用輸入中的統計或可觀察訊號，不得捏造聊天原文。";

function wait(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export class GeminiProvider implements AiProvider {
  name = "Gemini";

  private async request(input: string, model: string, apiKey: string) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: input }] }],
        generationConfig: { temperature: 0.35, responseMimeType: "application/json" },
      }),
    });
    if (!response.ok) {
      let detail = "";
      try {
        const errorJson = await response.json() as { error?: { message?: string; status?: string } };
        detail = errorJson.error?.message || errorJson.error?.status || "";
      } catch {
        detail = await response.text().catch(() => "");
      }
      throw new Error(`GEMINI_REQUEST_FAILED_${response.status}:${detail.slice(0, 180)}`);
    }
    return response.json() as Promise<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>;
  }

  async analyze(input: string) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("AI_NOT_CONFIGURED");
    const primaryModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.7-flash";
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || "gemini-3.6-flash";
    let json: { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null = null;
    let lastError: unknown;
    for (const model of [primaryModel, fallbackModel]) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          json = await this.request(input, model, apiKey);
          break;
        } catch (error) {
          lastError = error;
          const message = error instanceof Error ? error.message : "";
          const retryable = message.startsWith("GEMINI_REQUEST_FAILED_503") || message.startsWith("GEMINI_REQUEST_FAILED_429");
          if (!retryable || attempt === 1) break;
          await wait(650 * (attempt + 1));
        }
      }
      if (json) break;
      const errorMessage = lastError instanceof Error ? lastError.message : "";
      if (!errorMessage.startsWith("GEMINI_REQUEST_FAILED_503") && !errorMessage.startsWith("GEMINI_REQUEST_FAILED_429")) break;
    }
    if (!json) throw lastError instanceof Error ? lastError : new Error("GEMINI_REQUEST_FAILED_503");
    const content = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!content) throw new Error("AI_EMPTY_RESPONSE");
    const parsed = JSON.parse(content) as Partial<AiAnalysis>;
    return {
      provider: this.name,
      summary: typeof parsed.summary === "string" ? parsed.summary : "目前無法整理出摘要。",
      atmosphere: typeof parsed.atmosphere === "string" ? parsed.atmosphere : "目前無法可靠判斷整體氣氛。",
      observations: Array.isArray(parsed.observations) ? parsed.observations.filter((item): item is string => typeof item === "string").slice(0, 6) : [],
      cautions: Array.isArray(parsed.cautions) ? parsed.cautions.filter((item): item is string => typeof item === "string").slice(0, 6) : [],
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, Math.round(parsed.confidence))) : 50,
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings.filter((item): item is string => typeof item === "string").slice(0, 10) : [],
      communicationStyle: Array.isArray(parsed.communicationStyle) ? parsed.communicationStyle.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
      emotionalSignals: Array.isArray(parsed.emotionalSignals) ? parsed.emotionalSignals.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
      frictionPoints: Array.isArray(parsed.frictionPoints) ? parsed.frictionPoints.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
      actionableSuggestions: Array.isArray(parsed.actionableSuggestions) ? parsed.actionableSuggestions.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.filter((item): item is string => typeof item === "string").slice(0, 10) : [],
    } satisfies AiAnalysis;
  }
}

export class OpenRouterProvider implements AiProvider {
  name = "AI";

  async analyze(input: string) {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new Error("OPENROUTER_NOT_CONFIGURED");
    const model = process.env.OPENROUTER_MODEL?.trim() || "openrouter/free";
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://ai-chat-analyzer.vercel.app", "X-Title": "AI Chat Analyzer" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: input }], temperature: 0.35 }),
    });
    if (!response.ok) {
      let detail = "";
      try { const errorJson = await response.json() as { error?: { message?: string; code?: string } }; detail = errorJson.error?.message || errorJson.error?.code || ""; } catch { detail = await response.text().catch(() => ""); }
      throw new Error(`OPENROUTER_REQUEST_FAILED_${response.status}:${detail.slice(0, 180)}`);
    }
    const json = await response.json() as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content?.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    if (!raw) throw new Error("AI_EMPTY_RESPONSE");
    const parsed = JSON.parse(raw) as Partial<AiAnalysis>;
    return { provider: this.name, summary: typeof parsed.summary === "string" ? parsed.summary : "目前無法整理出摘要。", atmosphere: typeof parsed.atmosphere === "string" ? parsed.atmosphere : "目前無法可靠判斷整體氣氛。", observations: Array.isArray(parsed.observations) ? parsed.observations.filter((item): item is string => typeof item === "string").slice(0, 12) : [], cautions: Array.isArray(parsed.cautions) ? parsed.cautions.filter((item): item is string => typeof item === "string").slice(0, 8) : [], confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, Math.round(parsed.confidence))) : 50, keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings.filter((item): item is string => typeof item === "string").slice(0, 10) : [], communicationStyle: Array.isArray(parsed.communicationStyle) ? parsed.communicationStyle.filter((item): item is string => typeof item === "string").slice(0, 8) : [], emotionalSignals: Array.isArray(parsed.emotionalSignals) ? parsed.emotionalSignals.filter((item): item is string => typeof item === "string").slice(0, 8) : [], strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((item): item is string => typeof item === "string").slice(0, 8) : [], frictionPoints: Array.isArray(parsed.frictionPoints) ? parsed.frictionPoints.filter((item): item is string => typeof item === "string").slice(0, 8) : [], actionableSuggestions: Array.isArray(parsed.actionableSuggestions) ? parsed.actionableSuggestions.filter((item): item is string => typeof item === "string").slice(0, 8) : [], evidence: Array.isArray(parsed.evidence) ? parsed.evidence.filter((item): item is string => typeof item === "string").slice(0, 10) : [] } satisfies AiAnalysis;
  }
}

export function localAnalysis(report: AnalysisReport) {
  return safeFallback(report);
}

export function minimizedReport(report: AnalysisReport) {
  return {
    platform: report.platformLabel,
    period: `${report.overview.startDate}–${report.overview.endDate}`,
    participants: [report.me.name, report.them.name],
    counts: { total: report.overview.total, personA: report.overview.myMessages, personB: report.overview.theirMessages },
    initiative: report.initiative,
    response: { personA: report.response.me, personB: report.response.them, periods: report.response.byPeriod },
    engagement: report.engagement,
    emoji: report.emoji.byEmoji.slice(0, 8),
    topics: report.topics,
    personalities: report.personalities,
    events: report.events.slice(0, 12),
    quality: report.quality,
  };
}
