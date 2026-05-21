// @ts-nocheck
// This schema uses sqlite-core locally and pg-core on Vercel
// The adapter is chosen at runtime in index.ts

import { sql } from 'drizzle-orm'
import {
  pgTable,
  text,
  integer,
  doublePrecision as real,
  boolean,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

const url = process.env.DATABASE_URL || ''
const isPostgres = url.startsWith('postgres')

// Helper to switch between pgTable and sqliteTable? 
// Actually, since we want it to work on Vercel/Supabase, we MUST use pg-core for Postgres.
// Drizzle doesn't support using sqliteTable for Postgres databases.

// ── Users ─────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:           text('id').primaryKey(),
  email:        text('email').notNull().unique(),
  name:         text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role').notNull().default('SUPERVISOR'),
  phone:        text('phone'),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt:    text('updated_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── Sites ─────────────────────────────────────────────────────
export const sites = pgTable('sites', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  location:    text('location').notNull(),
  description: text('description'),
  status:      text('status').notNull().default('ACTIVE'),
  startDate:   text('start_date').notNull(),
  endDate:     text('end_date'),
  budget:      real('budget').notNull().default(0),
  createdById: text('created_by_id').notNull().references(() => users.id),
  createdAt:   text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt:   text('updated_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── Site Access ───────────────────────────────────────────────
export const siteAccess = pgTable('site_access', {
  id:     text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
}, (t) => ({ uniq: unique().on(t.userId, t.siteId) }))

// ── Work Types ────────────────────────────────────────────────
export const workTypes = pgTable('work_types', {
  id:        text('id').primaryKey(),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  unit:      text('unit').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── Work Logs ─────────────────────────────────────────────────
export const workLogs = pgTable('work_logs', {
  id:          text('id').primaryKey(),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  userId:      text('user_id').notNull().references(() => users.id),
  workTypeId:  text('work_type_id').notNull().references(() => workTypes.id),
  description: text('description'),
  quantity:    real('quantity').notNull(),
  unit:        text('unit').notNull(),
  date:        text('date').notNull(),
  synced:      boolean('synced').notNull().default(true),
  offlineId:   text('offline_id').unique(),
  createdAt:   text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── Materials ─────────────────────────────────────────────────
export const materials = pgTable('materials', {
  id:        text('id').primaryKey(),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  unit:      text('unit').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── Material Logs ─────────────────────────────────────────────
export const materialLogs = pgTable('material_logs', {
  id:         text('id').primaryKey(),
  siteId:     text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  materialId: text('material_id').notNull().references(() => materials.id),
  type:       text('type').notNull(),
  quantity:   real('quantity').notNull(),
  unitPrice:  real('unit_price'),
  notes:      text('notes'),
  date:       text('date').notNull(),
  synced:     boolean('synced').notNull().default(true),
  offlineId:  text('offline_id').unique(),
  createdAt:  text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── Ideal Rules ───────────────────────────────────────────────
export const idealRules = pgTable('ideal_rules', {
  id:          text('id').primaryKey(),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  workTypeId:  text('work_type_id').notNull().references(() => workTypes.id),
  materialId:  text('material_id').notNull().references(() => materials.id),
  idealQtyPer: real('ideal_qty_per').notNull(),
  description: text('description'),
  createdAt:   text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt:   text('updated_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── Labour ────────────────────────────────────────────────────
export const labour = pgTable('labour', {
  id:        text('id').primaryKey(),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  phone:     text('phone'),
  trade:     text('trade').notNull(),
  dailyWage: real('daily_wage').notNull(),
  status:    text('status').notNull().default('ACTIVE'),
  joinDate:  text('join_date').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── Attendance ────────────────────────────────────────────────
export const attendance = pgTable('attendance', {
  id:        text('id').primaryKey(),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  labourId:  text('labour_id').notNull().references(() => labour.id),
  userId:    text('user_id').notNull().references(() => users.id),
  date:      text('date').notNull(),
  status:    text('status').notNull(),
  halfDay:   boolean('half_day').notNull().default(false),
  overtime:  real('overtime'),
  notes:     text('notes'),
  synced:    boolean('synced').notNull().default(true),
  offlineId: text('offline_id').unique(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
}, (t) => ({ uniqLabourDate: unique().on(t.labourId, t.date) }))

// ── Payroll ───────────────────────────────────────────────────
export const payroll = pgTable('payroll', {
  id:          text('id').primaryKey(),
  labourId:    text('labour_id').notNull().references(() => labour.id),
  periodStart: text('period_start').notNull(),
  periodEnd:   text('period_end').notNull(),
  totalDays:   real('total_days').notNull(),
  dailyWage:   real('daily_wage').notNull(),
  overtime:    real('overtime').notNull().default(0),
  deductions:  real('deductions').notNull().default(0),
  netAmount:   real('net_amount').notNull(),
  status:      text('status').notNull().default('PENDING'),
  paidAt:      text('paid_at'),
  paymentMode: text('payment_mode'),
  notes:       text('notes'),
  createdAt:   text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── Accounting ────────────────────────────────────────────────
export const accounting = pgTable('accounting', {
  id:          text('id').primaryKey(),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  type:        text('type').notNull(),
  category:    text('category').notNull(),
  amount:      real('amount').notNull(),
  description: text('description').notNull(),
  paymentMode: text('payment_mode').notNull(),
  reference:   text('reference'),
  date:        text('date').notNull(),
  invoiceNo:   text('invoice_no'),
  lpoId:       text('lpo_id'),
  createdAt:   text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt:   text('updated_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── LPOs ─────────────────────────────────────────────────────
export const lpos = pgTable('lpos', {
  id:          text('id').primaryKey(),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  lpoNumber:   text('lpo_number').notNull().unique(),
  vendor:      text('vendor').notNull(),
  description: text('description').notNull(),
  amount:      real('amount').notNull(),
  status:      text('status').notNull().default('PENDING'),
  issueDate:   text('issue_date').notNull(),
  dueDate:     text('due_date'),
  createdAt:   text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
})


// ── Cashbooks ─────────────────────────────────────────────────
export const cashbooks = pgTable('cashbooks', {
  id:          text('id').primaryKey(),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  description: text('description'),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt:   text('updated_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── Cashbook Entries ──────────────────────────────────────────
export const cashbookEntries = pgTable('cashbook_entries', {
  id:           text('id').primaryKey(),
  cashbookId:   text('cashbook_id').notNull().references(() => cashbooks.id, { onDelete: 'cascade' }),
  siteId:       text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  type:         text('type').notNull(), // INCOME | EXPENSE | LPO
  category:     text('category').notNull(),
  amount:       real('amount').notNull(),
  description:  text('description').notNull(),
  paymentMode:  text('payment_mode').notNull(),
  reference:    text('reference'),
  vendor:       text('vendor'),
  date:         text('date').notNull(),
  lpoNumber:    text('lpo_number'),
  lpoStatus:    text('lpo_status'),
  partyName:    text('party_name'),
  proofUrl:     text('proof_url'),
  createdAt:    text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
})


// ── Parties ───────────────────────────────────────────────────
export const parties = pgTable('parties', {
  id:        text('id').primaryKey(),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  type:      text('type'),        // e.g. Supplier, Contractor, Client, Labour
  phone:     text('phone'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
})

export type Party = typeof parties.$inferSelect

// ── Labour Teams ──────────────────────────────────────────────
export const labourTeams = pgTable('labour_teams', {
  id:               text('id').primaryKey(),
  siteId:           text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:             text('name').notNull(),
  attendanceMethod: text('attendance_method').notNull().default('INDIVIDUAL'), // INDIVIDUAL | TEAM
  createdAt:        text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt:        text('updated_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── Team Members ──────────────────────────────────────────────
export const teamMembers = pgTable('team_members', {
  id:        text('id').primaryKey(),
  teamId:    text('team_id').notNull().references(() => labourTeams.id, { onDelete: 'cascade' }),
  labourId:  text('labour_id').notNull().references(() => labour.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
}, (t) => ({ uniq: unique().on(t.teamId, t.labourId) }))


// ── Site Locations ────────────────────────────────────────────
// Each location = one tower/span entry with its own work stage
export const siteLocations = pgTable('site_locations', {
  id:          text('id').primaryKey(),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  locationNo:  text('location_no').notNull(),   // e.g. "T-01", "L-05"
  towerType:   text('tower_type').notNull(),     // e.g. "Tangent", "Angle", "Dead End"
  span:        text('span'),                     // e.g. "A-B", "250m"
  workStage:   text('work_stage').notNull().default('FOUNDATION'),
  notes:       text('notes'),
  createdAt:   text('created_at').default(sql`CURRENT_TIMESTAMP::text`),
  updatedAt:   text('updated_at').default(sql`CURRENT_TIMESTAMP::text`),
})

export type SiteLocation = typeof siteLocations.$inferSelect

// ── Site Work Status ──────────────────────────────────────────
export const siteWorkStatus = pgTable('site_work_status', {
  id:               text('id').primaryKey(),
  siteId:           text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }).unique(),
  workStage:        text('work_stage').notNull().default('FOUNDATION'), // FOUNDATION | ERECTION | STRINGING | FINISHING | COMPLETED
  attendanceMethod: text('attendance_method').notNull().default('INDIVIDUAL'), // INDIVIDUAL | TEAM
  updatedAt:        text('updated_at').default(sql`CURRENT_TIMESTAMP::text`),
})

// ── New Type exports ──────────────────────────────────────────
export type Cashbook       = typeof cashbooks.$inferSelect
export type CashbookEntry  = typeof cashbookEntries.$inferSelect
export type LabourTeam     = typeof labourTeams.$inferSelect
export type TeamMember     = typeof teamMembers.$inferSelect
export type SiteWorkStatus = typeof siteWorkStatus.$inferSelect

// ── Types ─────────────────────────────────────────────────────
export type User        = typeof users.$inferSelect
export type Site        = typeof sites.$inferSelect
export type WorkType    = typeof workTypes.$inferSelect
export type WorkLog     = typeof workLogs.$inferSelect
export type Material    = typeof materials.$inferSelect
export type MaterialLog = typeof materialLogs.$inferSelect
export type IdealRule   = typeof idealRules.$inferSelect
export type Labour      = typeof labour.$inferSelect
export type Attendance  = typeof attendance.$inferSelect
export type Payroll     = typeof payroll.$inferSelect
export type Accounting  = typeof accounting.$inferSelect
export type LPO         = typeof lpos.$inferSelect
