import { pgTable, text, serial, boolean, timestamp, integer, unique, jsonb, numeric } from "drizzle-orm/pg-core";
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
  // #91 follow-up (job/pursuit redesign) — a plain freeform field, mainly
  // for the lightweight "My job" flow (which has nowhere else to put an
  // optional note since materials/budget/risk are business-task-shaped),
  // but exposed as a general optional field on every job for consistency.
  notes: text("notes").notNull().default(""),
  // #167 — Business/Side Hustle jobs can be a product, a service, or both
  // (a sign company sells a sign AND installs it; a consultant is
  // service-only; a side-hustle maker whose goods are sold through
  // someone else's store is product-only) — asked once per job in the
  // creation wizard, since the same pursuit can have jobs of either
  // shape. Empty string for every other category, same absent-value
  // convention as materials/budget/risk/notes above.
  productOrService: text("product_or_service").notNull().default(""),
  // #168 — a real, structured due date (YYYY-MM-DD, same convention as
  // commits.dueDate/comingUp.date), nullable, distinct from the free-text
  // `due` above: `due` stays a casual note ("end of month") nothing acts
  // on, while `dueDate` is the "set a reminder for this" field that
  // actually drives Calendar surfacing (GET /coming-up) and, eventually,
  // the reminder digest and Steward's chat context. A job can have either,
  // both, or neither. Supersedes the client-only `parseJobDueDate` heuristic
  // that used to guess a date out of `due`'s free text for Calendar display.
  dueDate: text("due_date"),
  // Soft-delete (#89), matching pursuits — "Delete Job" now closes rather
  // than permanently removing, with a Deleted-jobs list to Reopen from.
  deleted: boolean("deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  // #170 — Mark Complete/Reopen, mirroring the deleted/deletedAt shape
  // above exactly. `pctBeforeCompletion` remembers whatever `pct` was
  // right before Mark Complete forced it to 100, so Reopen can restore it
  // instead of dropping progress back to some arbitrary number. `completed`
  // is orthogonal to `deleted` — a completed job that's later soft-deleted
  // and then reopened from the Deleted list lands back in the Completed
  // list, not active, since only `deleted` gets touched there.
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  pctBeforeCompletion: integer("pct_before_completion"),
  // #175 — Business, Side Hustle, and Job only (the two named use cases in
  // the issue: job-costing a business job, tracking hours at an employee
  // job — Volunteer/Hobby/Other have no time-tracking use case). A single
  // running-total number, same shape as #172's expensesAmount, not
  // itemized time entries — that would be real time-tracking software, a
  // much bigger build than anything else on this roadmap.
  hoursLogged: numeric("hours_logged", { mode: "number" }),
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

// #93 — additional email addresses a user can receive commitment reminders
// at, beyond their account login email. The login email is never stored as
// a row here — it's always the implicit, non-removable fallback (see
// resolveActiveReminderEmail in lib/reminders.ts), which is what guarantees
// a user can never end up with zero usable reminder addresses. At most one
// row per user has active: true; a freshly-added row starts unverified
// (codeHash/codeExpiresAt set) until its emailed code is confirmed.
export const reminderEmails = pgTable("reminder_emails", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  verified: boolean("verified").notNull().default(false),
  active: boolean("active").notNull().default(false),
  codeHash: text("code_hash"),
  codeExpiresAt: timestamp("code_expires_at"),
  codeAttempts: integer("code_attempts").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("reminder_emails_user_email_unique").on(table.userId, table.email),
]);

export const insertReminderEmailSchema = createInsertSchema(reminderEmails).omit({ id: true, createdAt: true });
export type InsertReminderEmail = z.infer<typeof insertReminderEmailSchema>;
export type ReminderEmail = typeof reminderEmails.$inferSelect;

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

// #82 — "The Sphere": a weekly (not daily, unlike Pulse Check) self-examination
// across five fixed categories (family/yourself/community/provide/lead — see
// lib/sphere.ts). `weekStart` is the Monday of the ISO week the entry belongs
// to, the same role `date` plays on pulseChecks but week- rather than
// day-grained, so a user gets at most one row per category per week.
export const sphereChecks = pgTable("sphere_checks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  weekStart: text("week_start").notNull(),
  category: text("category").notNull(),
  state: text("state").notNull(),
  note: text("note").notNull().default(""),
  // Optional itemized answers from the guided "Walk through this" review —
  // one entry per question in that category's fixed question list (see
  // artifacts/arlo/src/pages/Home.tsx's SPHERE_QUESTIONS), each holding
  // {questionIndex, answer, note, followup, subAnswer}. Null when the state
  // was set manually (tapping a battery icon) rather than via the
  // walkthrough — the two are independent ways to set the same state/note,
  // per #82's settled spec. Opaque JSON rather than a separate table since
  // the question set itself is fixed application code, not user data.
  answers: jsonb("answers"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("sphere_checks_user_week_category_unique").on(table.userId, table.weekStart, table.category),
]);

export const insertSphereCheckSchema = createInsertSchema(sphereChecks).omit({ id: true, createdAt: true });
export type InsertSphereCheck = z.infer<typeof insertSphereCheckSchema>;
export type SphereCheck = typeof sphereChecks.$inferSelect;

// #77 — a user's favorited Verse of the Day entries. Keyed by the verse's
// reference string (e.g. "Ephesians 5:25"), not an array index into
// lib/verses.ts's VERSES — an index would silently break if that list is
// ever reordered. createdAt order is the stable cycle order the weighted
// rotation uses (lib/verses.ts's getVerseForUser).
export const verseFavorites = pgTable("verse_favorites", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  verseRef: text("verse_ref").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("verse_favorites_user_ref_unique").on(table.userId, table.verseRef),
]);

export const insertVerseFavoriteSchema = createInsertSchema(verseFavorites).omit({ id: true, createdAt: true });
export type InsertVerseFavorite = z.infer<typeof insertVerseFavoriteSchema>;
export type VerseFavorite = typeof verseFavorites.$inferSelect;

// #96 — a user's own verses (manually typed, not from lib/verses.ts's curated
// bank). `favorited` lives directly on the row rather than going through
// verseFavorites — that table's ref namespace and unique constraint assume
// every ref resolves against the global bank, which doesn't hold for
// per-user free text. `favorited` is what makes a custom verse join the
// daily/favorite rotation (lib/verses.ts); un-favoriting doesn't delete the
// row, same as removing a bank favorite doesn't touch the bank. Never fed
// into Steward's chat prompt — chat only ever quotes the human-checked bank.
export const customVerses = pgTable("custom_verses", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  ref: text("ref").notNull(),
  text: text("text").notNull(),
  favorited: boolean("favorited").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomVerseSchema = createInsertSchema(customVerses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomVerse = z.infer<typeof insertCustomVerseSchema>;
export type CustomVerse = typeof customVerses.$inferSelect;

// #137 — Tribe's auto-generated "Today's Intention" card. One row per
// user/date/relationship: an OpenAI-generated line about whoever is
// currently the Tribe tab's primary person (starred-first, else top of
// list — see primaryRelationship() in Home.tsx), generated lazily on first
// Tribe visit each day and cached for the rest of that day (lib/tribeIntention.ts).
// Keying on relationshipId, not just user+date, means a mid-day change of
// who's primary naturally misses the cache and generates a fresh row for
// the new pairing — no explicit invalidation logic needed.
export const tribeIntentions = pgTable("tribe_intentions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  relationshipId: integer("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("tribe_intentions_user_date_relationship_unique").on(table.userId, table.date, table.relationshipId),
]);

export const insertTribeIntentionSchema = createInsertSchema(tribeIntentions).omit({ id: true, createdAt: true });
export type InsertTribeIntention = z.infer<typeof insertTribeIntentionSchema>;
export type TribeIntention = typeof tribeIntentions.$inferSelect;
