import { localAnalysis, minimizedReport, OpenAIProvider } from "@/lib/ai/provider";
import type { AnalysisReport } from "@/lib/chat/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { report?: AnalysisReport };
    if (!body.report || !body.report.overview || !body.report.initiative) return Response.json({ error: "分析資料不足。" }, { status: 400 });
    const report = body.report;
    const provider = new OpenAIProvider();
    if (process.env.OPENAI_API_KEY) {
      const result = await provider.analyze(JSON.stringify(minimizedReport(report)));
      return Response.json(result);
    }
    return Response.json({ ...localAnalysis(report), provider: "local-summary" });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    console.error("[ai/analyze] upstream failure", raw);
    if (raw === "AI_NOT_CONFIGURED") return Response.json({ error: "AI 服務尚未設定，請在 Vercel 設定 OPENAI_API_KEY 後重新部署。" }, { status: 503 });
    if (raw.startsWith("AI_REQUEST_FAILED_401") || raw.startsWith("AI_REQUEST_FAILED_403")) return Response.json({ error: "OpenAI API 金鑰無效或沒有權限，請到 Vercel 檢查 OPENAI_API_KEY。" }, { status: 503 });
    if (raw.startsWith("AI_REQUEST_FAILED_404")) return Response.json({ error: "指定的 AI 模型不存在或目前無法使用，請將 OPENAI_MODEL 設為 gpt-4o-mini 後重新部署。" }, { status: 503 });
    if (raw.startsWith("AI_REQUEST_FAILED_429")) return Response.json({ error: "OpenAI API 暫時達到速率或使用量限制，請檢查 API 額度與帳務設定後再試。" }, { status: 503 });
    if (raw.startsWith("AI_REQUEST_FAILED_400")) return Response.json({ error: "AI 請求格式或模型設定不相容，請確認 OPENAI_MODEL 設為 gpt-4o-mini。" }, { status: 503 });
    if (raw.startsWith("AI_REQUEST_FAILED_")) return Response.json({ error: "OpenAI 暫時拒絕這次請求，請查看 Vercel Function Logs 的上游錯誤訊息。" }, { status: 503 });
    return Response.json({ error: "AI 暫時無法完成分析，請稍後再試。" }, { status: 503 });
  }
}
