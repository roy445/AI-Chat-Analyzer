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
    const message = error instanceof Error && error.message === "AI_NOT_CONFIGURED" ? "AI 服務目前尚未設定，基本分析仍可繼續使用。" : "AI 暫時無法完成分析，請稍後再試。";
    return Response.json({ error: message }, { status: 503 });
  }
}
