import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Explicitly stores report aggregates only. Raw chat messages never enter this table.
export const sharedReports = pgTable("shared_reports", {
  id: text("id").primaryKey(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
