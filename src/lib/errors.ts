export type ErrorSeverity = "S0" | "S1" | "S2" | "S3" | "S4";

export function errorResponse(code: string, message: string, status: number, severity: ErrorSeverity = status >= 500 ? "S1" : "S2") {
  return Response.json({ error: `抱歉，遇到了一些錯誤。${message}`, code, severity, reportUrl: `/report-error?code=${encodeURIComponent(code)}` }, { status });
}
