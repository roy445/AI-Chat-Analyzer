import { minimizedReport, GeminiProvider, OpenRouterProvider } from "@/lib/ai/provider";
import { localQuestionAnswer } from "@/lib/chat/v2";
import type { AnalysisReport } from "@/lib/chat/types";
import { errorResponse } from "@/lib/errors";
import { getSystemSettings, recordUsage } from "@/lib/service-control";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const settings = await getSystemSettings();
    if (!settings.aiEnabled) return errorResponse("AI-009", "AI 問答服務目前由管理員暫停；基本本機分析與報告仍可使用。", 503, "S1");
    if (settings.testErrorCode?.startsWith("AI-")) return errorResponse(settings.testErrorCode, "AI 問答目前暫時無法使用，請稍後再試。", 503, "S1");
    await recordUsage("ai");
    const body = await request.json() as { report?: AnalysisReport; question?: string };
    const question = body.question?.trim();
    if (!body.report || !question || question.length > 240) return Response.json({ error: "請輸入一個具體的聊天問題。" }, { status: 400 });
    const input = JSON.stringify({ question, report: minimizedReport(body.report) });
    if (process.env.GEMINI_API_KEY?.trim()) {
      try { const result = await new GeminiProvider().analyze(input); return Response.json({ answer: result.summary, provider: result.provider, confidence: result.confidence }); } catch (geminiError) {
        const message = geminiError instanceof Error ? geminiError.message : "";
        if (!(message.startsWith("GEMINI_REQUEST_FAILED_503") || message.startsWith("GEMINI_REQUEST_FAILED_429")) || !process.env.OPENROUTER_API_KEY?.trim()) throw geminiError;
        console.warn("[ai/ask] Gemini unavailable, switching to OpenRouter");
      }
    }
    if (process.env.OPENROUTER_API_KEY?.trim()) { const result = await new OpenRouterProvider().analyze(input); return Response.json({ answer: result.summary, provider: result.provider, confidence: result.confidence }); }
    return errorResponse("AI-004", "AI 問答尚未設定可用的 AI provider。", 503, "S1");
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    console.error("[ai/ask] upstream failure", raw);
    if (raw.startsWith("GEMINI_REQUEST_FAILED_401") || raw.startsWith("GEMINI_REQUEST_FAILED_403")) return errorResponse("AI-002", "Gemini API 金鑰無效或沒有權限，請到 Vercel 檢查 GEMINI_API_KEY。", 503, "S1");
    if (raw.startsWith("GEMINI_REQUEST_FAILED_404")) return errorResponse("AI-003", "Gemini 模型不存在或目前無法使用，請檢查 GEMINI_MODEL。", 503, "S1");
    if (raw.startsWith("GEMINI_REQUEST_FAILED_400")) return errorResponse("AI-007", "Gemini 請求格式或模型設定不相容。", 503, "S2");
    if (raw.startsWith("GEMINI_REQUEST_FAILED_429")) return errorResponse("AI-005", "Gemini API 暫時達到速率或使用量限制，系統已嘗試備援。", 503, "S2");
    if (raw.startsWith("GEMINI_REQUEST_FAILED_503")) return errorResponse("AI-010", "Gemini 目前需求過高且備援 AI 也無法完成問答，服務暫時停止。", 503, "S1");
    if (raw.startsWith("OPENROUTER_REQUEST_FAILED_")) return errorResponse("AI-010", "Gemini 與 OpenRouter 都無法完成問答，服務暫時停止。", 503, "S1");
    return Response.json({ error: "AI 問答暫時無法完成，請稍後再試。" }, { status: 503 });
  }
}
