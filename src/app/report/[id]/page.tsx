import { notFound } from "next/navigation";
import { db } from "@/db";
import { sharedReports } from "@/db/schema";
import { eq } from "drizzle-orm";
import ShareReportView from "@/app/share-report";
import { recordUsage } from "@/lib/service-control";
import type { AiAnalysis, AnalysisReport } from "@/lib/chat/types";

export const dynamic = "force-dynamic";

type StoredPayload = { report?: AnalysisReport; ai?: AiAnalysis | null; mode?: "full" | "recap" | "achievements"; sections?: string[]; anonymous?: boolean };

export default async function SharedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(id)) notFound();
  const [row] = await db.select({ payload: sharedReports.payload }).from(sharedReports).where(eq(sharedReports.id, id)).limit(1);
  const payload = row?.payload as StoredPayload | undefined;
  if (!payload?.report) notFound();
  await recordUsage("share_view");
  return <ShareReportView report={payload.report} ai={payload.ai} mode={payload.mode ?? "full"} sections={payload.sections} anonymous={payload.anonymous ?? true} />;
}
