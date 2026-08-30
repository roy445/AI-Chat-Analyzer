import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "ai_admin_session";
function secret() { return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim() || "change-me"; }
function token() { return createHmac("sha256", secret()).update("ai-chat-analyzer-admin").digest("hex"); }
export function validPassword(password: string) { const expected = process.env.ADMIN_PASSWORD?.trim(); if (!expected) return false; const a = Buffer.from(password); const b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a, b); }
export async function isAdmin() { return (await cookies()).get(COOKIE_NAME)?.value === token(); }
export function setAdminCookie(response: Response) { response.headers.append("Set-Cookie", `${COOKIE_NAME}=${token()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`); }
export function clearAdminCookie(response: Response) { response.headers.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`); }
