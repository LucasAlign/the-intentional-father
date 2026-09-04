import { pgTable, text, serial, boolean, timestamp, integer, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  reflect: text("reflect").notNull().default(""),
  commitText: text("commit_text").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("journal_entries_user_date_unique").on(table.userId, table.date),
]);

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
  category: text("category").notNull().default(""),
  notes: text("notes").notNull().default(""),
  partial: boolean("partial").notNull().default(false),
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("done_at"),
  deleted: boolean("deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  recurrencePeriod: text("recurrence_period"),
  recurrenceTarget: integer("recurrence_target"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const taskCompletions = pgTable("task_completions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  completedDate: text("completed_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("task_completions_task_date_unique").on(table.taskId, table.completedDate),
]);

export const insertTaskCompletionSchema = createInsertSchema(taskCompletions).omit({ id: true, createdAt: true });
export type InsertTaskCompletion = z.infer<typeof insertTaskCompletionSchema>;
export type TaskCompletion = typeof taskCompletions.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const relationships = pgTable("relationships", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name"),
  // Fixed set (spouse/child/family/friend) so sort order is exact, not guessed
  // from free text — see #13/#28's resolution.
  category: text("category").notNull(),
  // Free-text description for color (e.g. "wife", "college roommate") — not
  // used for sorting.
  type: text("type").notNull().default(""),
  notes: text("notes").notNull().default(""),
  commitments: text("commitments").notNull().default(""),
  biggestChallenge: text("biggest_challenge").notNull().default(""),
  // Pinned to the top of the People list — many can be true at once (#65).
  // Today's Intention reads whichever starred person sorts first. Defaults
  // to true for spouse/child at creation, false otherwise.
  starred: boolean("starred").notNull().default(false),
  // Manual drag position within the starred/unstarred group (#65) — null
  // means "not yet manually reordered, use the category-rank default".
  // Written a whole group at a time (PATCH /relationships/reorder), not
  // per-row, so it's never ambiguous relative to other rows in the group.
  sortOrder: integer("sort_order"),
  // Soft delete (#64), matching tasks (#54) and commits (#60) — the row
  // moves to the Deleted view (GET /relationships/deleted) and can be
  // restored via PATCH { deleted: false }, or hard-removed via the
  // separate DELETE /relationships/:id/permanent.
  deleted: boolean("deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRelationshipSchema = createInsertSchema(relationships).omit({ id: true, createdAt: true });
export type InsertRelationship = z.infer<typeof insertRelationshipSchema>;
export type Relationship = typeof relationships.$inferSelect;

export const commits = pgTable("commits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
  notes: text("notes").notNull().default(""),
  madeDate: text("made_date").notNull(),
  dueDate: text("due_date"),
  done: boolean("done").notNull().default(false),
  deleted: boolean("deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  // Superseded by commitRelationshipTargets (#72) — left in place, no
  // longer read or written, rather than a destructive column drop (same
  // treatment as jobs.biz post-#29). migrateCommitTargets() backfills any
  // pre-#72 value here into the new table once.
  relationshipId: integer("relationship_id").references(() => relationships.id, { onDelete: "set null" }),
  // A one-time commitment target not added to the permanent Tribe list —
  // mutually exclusive with relationship targeting, whether the single old
  // relationshipId (#60) or the new multi-person commitRelationshipTargets
  // (#72).
  adHocName: text("ad_hoc_name"),
  adHocCategory: text("ad_hoc_category"),
  // Set once the daily reminder digest (#75) has included this commit in its
  // "due today"/"due tomorrow" or "overdue" section, respectively — each
  // fires at most once per commit, not every day it stays in that window.
  // Null means "not yet reminded for that transition".
  remindedDueAt: timestamp("reminded_due_at"),
  remindedOverdueAt: timestamp("reminded_overdue_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCommitSchema = createInsertSchema(commits).omit({ id: true, createdAt: true });
export type InsertCommit = z.infer<typeof insertCommitSchema>;
export type Commit = typeof commits.$inferSelect;

// One row per (commitment, person) pair — a commitment can name 1+ Tribe
// people (#72), e.g. a promise made to both a spouse and kids together.
// Never mixed with the ad-hoc one-time target above: a commitment is either
// this, or an ad-hoc name+category, never both. `userId` is denormalized
// from the owning commit so RLS can scope this table directly, matching
// every other per-user table's policy rather than relying only on
// application-level scoping.
export const commitRelationshipTargets = pgTable("commit_relationship_targets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  commitId: integer("commit_id").notNull().references(() => commits.id, { onDelete: "cascade" }),
  // Cascades on delete — permanently deleting a person just drops their row
  // here, same as leaving the commitment with whoever's left; no app code
  // needed for that edge case.
  relationshipId: integer("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("commit_relationship_targets_unique").on(table.commitId, table.relationshipId),
]);

export type CommitRelationshipTarget = typeof commitRelationshipTargets.$inferSelect;

export const pursuits = pgTable("pursuits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  // Fixed set (job/business/volunteer/other) — see #14/#29's resolution.
  category: text("category").notNull(),
  notes: text("notes").notNull().default(""),
  // Soft "closed" state (#48), matching tasks/commits/relationships — set
  // automatically when a pursuit's last job crosses to 100%, or manually
  // (e.g. abandoning one that never finished). Its jobs aren't touched;
  // they just aren't shown once their parent pursuit is filtered out.
  deleted: boolean("deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPursuitSchema = createInsertSchema(pursuits).omit({ id: true, createdAt: true });
export type InsertPursuit = z.infer<typeof insertPursuitSchema>;
export type Pursuit = typeof pursuits.$inferSelect;

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  // Superseded by pursuitId (#29) — left in place, no longer read or
  // written, rather than a destructive column drop.
  biz: text("biz").notNull().default(""),
  name: text("name").notNull(),
  stage: text("stage").notNull().default(""),
  due: text("due").notNull().default(""),
  pct: integer("pct").notNull().default(0),
  pursuitId: integer("pursuit_id").references(() => pursuits.id, { onDelete: "set null" }),
  // The add-job wizard asks all three of these but used to throw the
  // answers away — nothing on the backend had anywhere to put them (#30).
  materials: text("materials").notNull().default(""),
  budget: text("budget").notNull().default(""),
  risk: text("risk").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export const comingUp = pgTable("coming_up", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
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

export const pulseChecks = pgTable("pulse_checks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  category: text("category").notNull(),
  state: text("state").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("pulse_checks_user_date_category_unique").on(table.userId, table.date, table.category),
]);

export const insertPulseCheckSchema = createInsertSchema(pulseChecks).omit({ id: true, createdAt: true });
export type InsertPulseCheck = z.infer<typeof insertPulseCheckSchema>;
export type PulseCheck = typeof pulseChecks.$inferSelect;
