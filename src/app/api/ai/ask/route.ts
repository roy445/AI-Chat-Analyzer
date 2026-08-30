import { minimizedReport, OpenAIProvider } from "@/lib/ai/provider";
import { localQuestionAnswer } from "@/lib/chat/v2";
import type { AnalysisReport } from "@/lib/chat/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { report?: AnalysisReport; question?: string };
    const question = body.question?.trim();
    if (!body.report || !question || question.length > 240) return Response.json({ error: "請輸入一個具體的聊天問題。" }, { status: 400 });
    if (process.env.OPENAI_API_KEY) {
      const provider = new OpenAIProvider();
      const result = await provider.analyze(JSON.stringify({ question, report: minimizedReport(body.report) }));
      return Response.json({ answer: result.summary, provider: result.provider, confidence: result.confidence });
    }
    return Response.json({ answer: localQuestionAnswer(body.report, question), provider: "local-summary", confidence: body.report.v2.quality.completeness === "高" ? 72 : 43 });
  } catch {
    return Response.json({ error: "AI 問答暫時無法完成，請稍後再試。" }, { status: 503 });
  }
}
