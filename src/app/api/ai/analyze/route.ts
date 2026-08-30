import { localAnalysis, minimizedReport, GeminiProvider, OpenRouterProvider } from "@/lib/ai/provider";
import type { AnalysisReport } from "@/lib/chat/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { report?: AnalysisReport };
    if (!body.report || !body.report.overview || !body.report.initiative) return Response.json({ error: "分析資料不足。" }, { status: 400 });
    const report = body.report;
    const input = JSON.stringify(minimizedReport(report));
    const gemini = new GeminiProvider();
    if (process.env.GEMINI_API_KEY?.trim()) {
      try { return Response.json(await gemini.analyze(input)); } catch (geminiError) {
        const message = geminiError instanceof Error ? geminiError.message : "";
        const canFallback = (message.startsWith("GEMINI_REQUEST_FAILED_503") || message.startsWith("GEMINI_REQUEST_FAILED_429")) && process.env.OPENROUTER_API_KEY?.trim();
        if (!canFallback) throw geminiError;
        console.warn("[ai/analyze] Gemini unavailable, switching to OpenRouter");
      }
    }
    if (process.env.OPENROUTER_API_KEY?.trim()) return Response.json(await new OpenRouterProvider().analyze(input));
    return Response.json({ ...localAnalysis(report), provider: "local-summary" });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    console.error("[ai/analyze] upstream failure", raw);
    if (raw === "AI_NOT_CONFIGURED") return Response.json({ error: "AI 服務尚未設定，請在 Vercel 設定 GEMINI_API_KEY 後重新部署。" }, { status: 503 });
    if (raw.startsWith("GEMINI_REQUEST_FAILED_401") || raw.startsWith("GEMINI_REQUEST_FAILED_403")) return Response.json({ error: "Gemini API 金鑰無效或沒有權限，請到 Vercel 檢查 GEMINI_API_KEY。" }, { status: 503 });
    if (raw.startsWith("GEMINI_REQUEST_FAILED_404")) return Response.json({ error: "指定的 Gemini 模型不存在或目前無法使用，請將 GEMINI_MODEL 設為 gemini-3.7-flash 後重新部署。" }, { status: 503 });
    if (raw.startsWith("GEMINI_REQUEST_FAILED_429")) return Response.json({ error: "Gemini API 暫時達到速率或使用量限制，請檢查 Google AI Studio 的額度與帳務設定後再試。" }, { status: 503 });
    if (raw.startsWith("GEMINI_REQUEST_FAILED_400")) return Response.json({ error: "Gemini 請求格式或模型設定不相容，請確認 GEMINI_MODEL 設為 gemini-3.7-flash。" }, { status: 503 });
    if (raw.startsWith("GEMINI_REQUEST_FAILED_")) return Response.json({ error: "Gemini 暫時拒絕這次請求，且沒有可用的備援 AI。請稍後再試或設定 OPENROUTER_API_KEY。" }, { status: 503 });
    if (raw.startsWith("OPENROUTER_REQUEST_FAILED_401") || raw.startsWith("OPENROUTER_REQUEST_FAILED_403")) return Response.json({ error: "OpenRouter API 金鑰無效或沒有權限，請檢查 OPENROUTER_API_KEY。" }, { status: 503 });
    if (raw.startsWith("OPENROUTER_REQUEST_FAILED_")) return Response.json({ error: "OpenRouter 暫時無法完成分析，請稍後再試或更換 OPENROUTER_MODEL。" }, { status: 503 });
    return Response.json({ error: "AI 暫時無法完成分析，請稍後再試。" }, { status: 503 });
  }
}
