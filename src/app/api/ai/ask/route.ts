import { minimizedReport, GeminiProvider } from "@/lib/ai/provider";
import { localQuestionAnswer } from "@/lib/chat/v2";
import type { AnalysisReport } from "@/lib/chat/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { report?: AnalysisReport; question?: string };
    const question = body.question?.trim();
    if (!body.report || !question || question.length > 240) return Response.json({ error: "請輸入一個具體的聊天問題。" }, { status: 400 });
    if (process.env.GEMINI_API_KEY?.trim()) {
      const provider = new GeminiProvider();
      const result = await provider.analyze(JSON.stringify({ question, report: minimizedReport(body.report) }));
      return Response.json({ answer: result.summary, provider: result.provider, confidence: result.confidence });
    }
    return Response.json({ answer: localQuestionAnswer(body.report, question), provider: "local-summary", confidence: body.report.v2.quality.completeness === "高" ? 72 : 43 });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    console.error("[ai/ask] upstream failure", raw);
    if (raw.startsWith("GEMINI_REQUEST_FAILED_401") || raw.startsWith("GEMINI_REQUEST_FAILED_403")) return Response.json({ error: "Gemini API 金鑰無效或沒有權限，請到 Vercel 檢查 GEMINI_API_KEY。" }, { status: 503 });
    if (raw.startsWith("GEMINI_REQUEST_FAILED_404") || raw.startsWith("GEMINI_REQUEST_FAILED_400")) return Response.json({ error: "Gemini 模型設定不相容，請將 GEMINI_MODEL 設為 gemini-3.7-flash 後重新部署。" }, { status: 503 });
    if (raw.startsWith("GEMINI_REQUEST_FAILED_429")) return Response.json({ error: "Gemini API 暫時達到速率或使用量限制，請檢查 Google AI Studio 的額度與帳務設定後再試。" }, { status: 503 });
    return Response.json({ error: "AI 問答暫時無法完成，請稍後再試。" }, { status: 503 });
  }
}
