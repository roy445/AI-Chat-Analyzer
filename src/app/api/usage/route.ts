import { recordUsage, type UsageEventType } from "@/lib/service-control";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS: UsageEventType[] = [
  "analysis_start", "analysis_complete", "ai_start", "ai_complete",
  "file_parse_start", "file_parse_complete", "share_create", "share_view",
];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { eventType?: string };
  if (!body.eventType || !ALLOWED_EVENTS.includes(body.eventType as UsageEventType)) {
    return Response.json({ ok: false, error: "不支援的使用事件。" }, { status: 400 });
  }
  await recordUsage(body.eventType as UsageEventType);
  return Response.json({ ok: true });
}
