import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const systemSettings = pgTable("system_settings", {
  id: integer("id").primaryKey().default(1),
  analysisEnabled: boolean("analysis_enabled").notNull().default(true),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  sharingEnabled: boolean("sharing_enabled").notNull().default(true),
  announcement: text("announcement"),
  announcementLevel: text("announcement_level").notNull().default("info"),
  testErrorCode: text("test_error_code"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usageEvents = pgTable("usage_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
