import { localAnalysis, minimizedReport, GeminiProvider, OpenRouterProvider } from "@/lib/ai/provider";
import type { AnalysisReport } from "@/lib/chat/types";
import { errorResponse } from "@/lib/errors";
import { notifyCritical } from "@/lib/critical-notify";
import { getSystemSettings, recordUsage } from "@/lib/service-control";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const settings = await getSystemSettings();
    if (!settings.analysisEnabled) return errorResponse("ANALYSIS-001", "分析服務目前由管理員暫停，請稍後再試。", 503, "S1");
    if (settings.testErrorCode?.startsWith("ANALYSIS-")) return errorResponse(settings.testErrorCode, "這是管理員啟用的分析錯誤測試。", 503, "S1");
    await recordUsage("analysis_start");
    const body = await request.json() as { report?: AnalysisReport };
    if (!body.report || !body.report.overview || !body.report.initiative) return Response.json({ error: "分析資料不足。" }, { status: 400 });
    const report = body.report;
    const input = JSON.stringify(minimizedReport(report));
    const gemini = new GeminiProvider();
    if (!settings.aiEnabled) { const result = { ...localAnalysis(report), provider: "local-summary" }; await recordUsage("analysis_complete"); return Response.json(result); }
    if (settings.testErrorCode?.startsWith("AI-")) return errorResponse(settings.testErrorCode, "這是管理員啟用的 AI 錯誤測試。", 503, "S1");
    await recordUsage("ai_start");
    if (process.env.GEMINI_API_KEY?.trim()) {
      try { const result = await gemini.analyze(input); await recordUsage("ai_complete"); await recordUsage("analysis_complete"); return Response.json(result); } catch (geminiError) {
        const message = geminiError instanceof Error ? geminiError.message : "";
        const canFallback = (message.startsWith("GEMINI_REQUEST_FAILED_503") || message.startsWith("GEMINI_REQUEST_FAILED_429")) && process.env.OPENROUTER_API_KEY?.trim();
        if (!canFallback) throw geminiError;
        console.warn("[ai/analyze] Gemini unavailable, switching to OpenRouter");
      }
    }
    if (process.env.OPENROUTER_API_KEY?.trim()) { const result = await new OpenRouterProvider().analyze(input); await recordUsage("ai_complete"); await recordUsage("analysis_complete"); return Response.json(result); }
    const result = { ...localAnalysis(report), provider: "local-summary" }; await recordUsage("analysis_complete"); return Response.json(result);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    console.error("[ai/analyze] upstream failure", raw);
    if (raw.startsWith("GEMINI_REQUEST_FAILED_") || raw.startsWith("OPENROUTER_REQUEST_FAILED_")) notifyCritical("AI-010", raw);
    if (raw === "AI_NOT_CONFIGURED") return errorResponse("AI-001", "AI 服務尚未設定，請在 Vercel 設定 GEMINI_API_KEY 或 OPENROUTER_API_KEY。", 503, "S1");
    if (raw.startsWith("GEMINI_REQUEST_FAILED_401") || raw.startsWith("GEMINI_REQUEST_FAILED_403")) return errorResponse("AI-002", "Gemini API 金鑰無效或沒有權限，請到 Vercel 檢查 GEMINI_API_KEY。", 503, "S1");
    if (raw.startsWith("GEMINI_REQUEST_FAILED_404")) return errorResponse("AI-003", "指定的 Gemini 模型不存在或目前無法使用，請檢查 GEMINI_MODEL。", 503, "S1");
    if (raw.startsWith("GEMINI_REQUEST_FAILED_429")) return errorResponse("AI-005", "Gemini API 暫時達到速率或使用量限制，系統已嘗試備援；請稍後再試。", 503, "S2");
    if (raw.startsWith("GEMINI_REQUEST_FAILED_400")) return errorResponse("AI-007", "Gemini 請求格式或模型設定不相容，請檢查模型與 JSON 設定。", 503, "S2");
    if (raw.startsWith("GEMINI_REQUEST_FAILED_")) return errorResponse("AI-010", "Gemini 與備援 AI 都無法完成分析，分析服務暫時停止。", 503, "S1");
    if (raw.startsWith("OPENROUTER_REQUEST_FAILED_401") || raw.startsWith("OPENROUTER_REQUEST_FAILED_403")) return errorResponse("AI-002", "OpenRouter API 金鑰無效或沒有權限，請檢查 OPENROUTER_API_KEY。", 503, "S1");
    if (raw.startsWith("OPENROUTER_REQUEST_FAILED_")) return errorResponse("AI-010", "Gemini 與 OpenRouter 都無法完成分析，分析服務暫時停止。", 503, "S1");
    return Response.json({ error: "AI 暫時無法完成分析，請稍後再試。" }, { status: 503 });
  }
}
