import { pgTable, text, serial, boolean, timestamp, integer, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  reflect: text("reflect").notNull().default(""),
  commitText: text("commit_text").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  category: text("category").notNull().default(""),
  notes: text("notes").notNull().default(""),
  partial: boolean("partial").notNull().default(false),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const commits = pgTable("commits", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  madeDate: text("made_date").notNull(),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCommitSchema = createInsertSchema(commits).omit({ id: true, createdAt: true });
export type InsertCommit = z.infer<typeof insertCommitSchema>;
export type Commit = typeof commits.$inferSelect;

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  biz: text("biz").notNull(),
  name: text("name").notNull(),
  stage: text("stage").notNull().default(""),
  due: text("due").notNull().default(""),
  pct: integer("pct").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export const comingUp = pgTable("coming_up", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  title: text("title").notNull(),
  sub: text("sub").notNull().default(""),
  tag: text("tag").notNull().default(""),
  kind: text("kind").notNull().default("work"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertComingUpSchema = createInsertSchema(comingUp).omit({ id: true, createdAt: true });
export type InsertComingUp = z.infer<typeof insertComingUpSchema>;
export type ComingUp = typeof comingUp.$inferSelect;


export const googleCalendarConnections = pgTable("google_calendar_connections", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  googleEmail: text("google_email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  scope: text("scope").notNull().default(""),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("gcal_user_email_unique").on(table.userId, table.googleEmail),
]);

export const insertGoogleCalendarConnectionSchema = createInsertSchema(googleCalendarConnections).omit({ createdAt: true, updatedAt: true });
export type InsertGoogleCalendarConnection = z.infer<typeof insertGoogleCalendarConnectionSchema>;
export type GoogleCalendarConnection = typeof googleCalendarConnections.$inferSelect;

export const profile = pgTable("profile", {
  userId: text("user_id").primaryKey(),
  data: jsonb("data"),
  onboarded: boolean("onboarded").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Profile = typeof profile.$inferSelect;

export const interviewMessages = pgTable("interview_messages", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
