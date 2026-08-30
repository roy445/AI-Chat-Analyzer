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
  };
}

export class OpenAIProvider implements AiProvider {
  name = "OpenAI";

  async analyze(input: string) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("AI_NOT_CONFIGURED");
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你是繁體中文聊天互動分析助手。只能根據輸入的匿名化統計與摘要回答，不可臆測未提供的內容，不可診斷心理，不可判定喜歡或討厭。每項推測使用可能、疑似、從聊天紀錄來看。輸出 JSON keys: summary, atmosphere, observations(array), cautions(array), confidence(number 0-100), provider。" },
          { role: "user", content: input },
        ],
      }),
    });
    if (!response.ok) throw new Error("AI_REQUEST_FAILED");
    const json = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI_EMPTY_RESPONSE");
    const parsed = JSON.parse(content) as Partial<AiAnalysis>;
    return {
      provider: this.name,
      summary: typeof parsed.summary === "string" ? parsed.summary : "目前無法整理出摘要。",
      atmosphere: typeof parsed.atmosphere === "string" ? parsed.atmosphere : "目前無法可靠判斷整體氣氛。",
      observations: Array.isArray(parsed.observations) ? parsed.observations.filter((item): item is string => typeof item === "string").slice(0, 6) : [],
      cautions: Array.isArray(parsed.cautions) ? parsed.cautions.filter((item): item is string => typeof item === "string").slice(0, 4) : [],
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, Math.round(parsed.confidence))) : 50,
    } satisfies AiAnalysis;
  }
}

export function localAnalysis(report: AnalysisReport) {
  return safeFallback(report);
}

export function minimizedReport(report: AnalysisReport) {
  return {
    platform: report.platformLabel,
    period: `${report.overview.startDate}–${report.overview.endDate}`,
    participants: ["PERSON_A", "PERSON_B"],
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
