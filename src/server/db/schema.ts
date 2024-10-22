import type { AdapterAccount } from "@auth/core/adapters";
import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, json, pgTableCreator, primaryKey, real, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const pgTable = pgTableCreator((name) => `compet_app_${name}`);

export const users = pgTable("user", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("emailVerified", {
    mode: "date",
  }).default(sql`CURRENT_TIMESTAMP(3)`),
  image: varchar("image", { length: 255 }),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accounts = pgTable(
  "account",
  {
    userId: varchar("userId", { length: 255 }).notNull(),
    type: varchar("type", { length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey(account.provider, account.providerAccountId),
    userIdIdx: index("account_userId_idx").on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = pgTable(
  "session",
  {
    sessionToken: varchar("sessionToken", { length: 255 }).notNull().primaryKey(),
    userId: varchar("userId", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_userId_idx").on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export const forecastProfiles = pgTable("forecastProfile", {
  id: serial("id").notNull().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),

  includeSales: boolean("include_sales").notNull().default(true),
  salesIncrementFactor: real("sales_increment_factor").notNull(),

  includeBudgets: boolean("include_budgets").notNull().default(true),
  budgetsInclusionFactor: real("budgets_inclusion_factor").notNull(),

  clientInclusionList: json("include_clients").$type<string[] | null>().default(null),

  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});

export const settings = pgTable("setting", {
  key: varchar("key", { length: 255 }).notNull().primaryKey().unique(),

  value: json("value").$type<unknown>().default(null),
});

export const userSettings = pgTable(
  "user_setting",
  {
    userId: varchar("userId", { length: 255 }).notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    value: json("value").$type<unknown>().default(null),
  },
  (us) => ({
    compoundKey: primaryKey(us.userId, us.key),
  }),
);

export const cuts = pgTable("cuts", {
  id: serial("id").notNull().primaryKey(),
  prodId: varchar("prodId", { length: 255 }).notNull(),
  lote: varchar("lote", { length: 255 }),
  caja: varchar("caja", { length: 255 }),
  location: varchar("location", { length: 255 }),
  // n de cortes disponibles
  amount: real("amount").notNull(),
  // longitud o ctd
  measure: real("measure").notNull(),
  // tipo de measure (ver en lib/types.ts)
  units: varchar("units", { length: 255 }).notNull(),
  stockPhys: varchar("stockPhys").notNull(),
  stockTango: varchar("stockTango").notNull(),
});

export const excelCutsDocs = pgTable("excelCutsDocs", {
  id: varchar("id", { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  url: varchar("url", { length: 255 }).notNull(),
  uploadAt: timestamp("date", { mode: "date" }).notNull(),
});
