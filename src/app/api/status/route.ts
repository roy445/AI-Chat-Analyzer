import { getSystemSettings } from "@/lib/service-control";

export const dynamic = "force-dynamic";

export async function GET() {
  try { const settings = await getSystemSettings(); return Response.json({ analysisEnabled: settings.analysisEnabled, aiEnabled: settings.aiEnabled, sharingEnabled: settings.sharingEnabled, announcement: settings.announcement, announcementLevel: settings.announcementLevel }); } catch { return Response.json({ analysisEnabled: true, aiEnabled: true, sharingEnabled: true, announcement: null, announcementLevel: "info" }); }
}
