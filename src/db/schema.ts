import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const systemSettings = pgTable("system_settings", {
  id: integer("id").primaryKey().default(1),
  analysisEnabled: boolean("analysis_enabled").notNull().default(true),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  sharingEnabled: boolean("sharing_enabled").notNull().default(true),
  announcement: text("announcement"),
  announcementLevel: text("announcement_level").notNull().default("info"),
  announcementExpiresAt: timestamp("announcement_expires_at", { withTimezone: true }),
  testErrorCode: text("test_error_code"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usageEvents = pgTable("usage_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  sessionId: text("session_id"),
  page: text("page"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const feedbackSubmissions = pgTable("feedback_submissions", {
  id: serial("id").primaryKey(),
  fingerprint: text("fingerprint").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(),
  type: text("type").notNull(),
  errorCode: text("error_code"),
  errorName: text("error_name"),
  page: text("page"),
  message: text("message").notNull(),
  email: text("email"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const announcementHistory = pgTable("announcement_history", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  level: text("level").notNull().default("info"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const errorTestHistory = pgTable("error_test_history", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  severity: text("severity").notNull(),
  source: text("source").notNull().default("test"),
  message: text("message"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  stoppedAt: timestamp("stopped_at", { withTimezone: true }),
});

// Explicitly stores report aggregates only. Raw chat messages never enter this table.
export const sharedReports = pgTable("shared_reports", {
  id: text("id").primaryKey(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
