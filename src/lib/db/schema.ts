// @ts-nocheck
// This schema uses sqlite-core locally and pg-core on Vercel
// The adapter is chosen at runtime in index.ts

import { sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  real,
  unique as sqliteUnique,
} from 'drizzle-orm/sqlite-core'

// ── Users ─────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email:        text('email').notNull().unique(),
  name:         text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role').notNull().default('SUPERVISOR'),
  phone:        text('phone'),
  isActive:     integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:    text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:    text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ── Sites ─────────────────────────────────────────────────────
export const sites = sqliteTable('sites', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:        text('name').notNull(),
  location:    text('location').notNull(),
  description: text('description'),
  status:      text('status').notNull().default('ACTIVE'),
  startDate:   text('start_date').notNull(),
  endDate:     text('end_date'),
  budget:      real('budget').notNull().default(0),
  createdById: text('created_by_id').notNull().references(() => users.id),
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:   text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ── Site Access ───────────────────────────────────────────────
export const siteAccess = sqliteTable('site_access', {
  id:     text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
}, (t) => ({ uniq: sqliteUnique().on(t.userId, t.siteId) }))

// ── Work Types ────────────────────────────────────────────────
export const workTypes = sqliteTable('work_types', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  unit:      text('unit').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ── Work Logs ─────────────────────────────────────────────────
export const workLogs = sqliteTable('work_logs', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  userId:      text('user_id').notNull().references(() => users.id),
  workTypeId:  text('work_type_id').notNull().references(() => workTypes.id),
  description: text('description'),
  quantity:    real('quantity').notNull(),
  unit:        text('unit').notNull(),
  date:        text('date').notNull(),
  synced:      integer('synced', { mode: 'boolean' }).notNull().default(true),
  offlineId:   text('offline_id').unique(),
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ── Materials ─────────────────────────────────────────────────
export const materials = sqliteTable('materials', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  unit:      text('unit').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ── Material Logs ─────────────────────────────────────────────
export const materialLogs = sqliteTable('material_logs', {
  id:         text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:     text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  materialId: text('material_id').notNull().references(() => materials.id),
  type:       text('type').notNull(),
  quantity:   real('quantity').notNull(),
  unitPrice:  real('unit_price'),
  notes:      text('notes'),
  date:       text('date').notNull(),
  synced:     integer('synced', { mode: 'boolean' }).notNull().default(true),
  offlineId:  text('offline_id').unique(),
  createdAt:  text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ── Ideal Rules ───────────────────────────────────────────────
export const idealRules = sqliteTable('ideal_rules', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  workTypeId:  text('work_type_id').notNull().references(() => workTypes.id),
  materialId:  text('material_id').notNull().references(() => materials.id),
  idealQtyPer: real('ideal_qty_per').notNull(),
  description: text('description'),
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:   text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ── Labour ────────────────────────────────────────────────────
export const labour = sqliteTable('labour', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  phone:     text('phone'),
  trade:     text('trade').notNull(),
  dailyWage: real('daily_wage').notNull(),
  status:    text('status').notNull().default('ACTIVE'),
  joinDate:  text('join_date').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ── Attendance ────────────────────────────────────────────────
export const attendance = sqliteTable('attendance', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  labourId:  text('labour_id').notNull().references(() => labour.id),
  userId:    text('user_id').notNull().references(() => users.id),
  date:      text('date').notNull(),
  status:    text('status').notNull(),
  halfDay:   integer('half_day', { mode: 'boolean' }).notNull().default(false),
  overtime:  real('overtime'),
  notes:     text('notes'),
  synced:    integer('synced', { mode: 'boolean' }).notNull().default(true),
  offlineId: text('offline_id').unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({ uniqLabourDate: sqliteUnique().on(t.labourId, t.date) }))

// ── Payroll ───────────────────────────────────────────────────
export const payroll = sqliteTable('payroll', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
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
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ── Accounting ────────────────────────────────────────────────
export const accounting = sqliteTable('accounting', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
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
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:   text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ── LPOs ─────────────────────────────────────────────────────
export const lpos = sqliteTable('lpos', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  lpoNumber:   text('lpo_number').notNull().unique(),
  vendor:      text('vendor').notNull(),
  description: text('description').notNull(),
  amount:      real('amount').notNull(),
  status:      text('status').notNull().default('PENDING'),
  issueDate:   text('issue_date').notNull(),
  dueDate:     text('due_date'),
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
})


// ── Cashbooks ─────────────────────────────────────────────────
export const cashbooks = sqliteTable('cashbooks', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  description: text('description'),
  isActive:    integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:   text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ── Cashbook Entries ──────────────────────────────────────────
export const cashbookEntries = sqliteTable('cashbook_entries', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
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
  partyName:        text('party_name'),
  proofUrl:         text('proof_url'),
  customFieldValues: text('custom_field_values'), // JSON
  addedBy:          text('added_by'),        // name of user who added
  addedById:        text('added_by_id'),     // id of user who added
  createdAt:        text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:        text('updated_at'),
})


// ── Parties ───────────────────────────────────────────────────
export const parties = sqliteTable('parties', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  type:      text('type'),        // e.g. Supplier, Contractor, Client, Labour
  phone:     text('phone'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type Party = typeof parties.$inferSelect

// ── Labour Teams ──────────────────────────────────────────────
export const labourTeams = sqliteTable('labour_teams', {
  id:               text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:           text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:             text('name').notNull(),
  attendanceMethod: text('attendance_method').notNull().default('INDIVIDUAL'), // INDIVIDUAL | TEAM
  createdAt:        text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:        text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ── Team Members ──────────────────────────────────────────────
export const teamMembers = sqliteTable('team_members', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  teamId:    text('team_id').notNull().references(() => labourTeams.id, { onDelete: 'cascade' }),
  labourId:  text('labour_id').notNull().references(() => labour.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({ uniq: sqliteUnique().on(t.teamId, t.labourId) }))


// ── Site Locations ────────────────────────────────────────────
// Each location = one tower/span entry with its own work stage
export const siteLocations = sqliteTable('site_locations', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  locationNo:  text('location_no').notNull(),   // e.g. "T-01", "L-05"
  towerType:   text('tower_type').notNull(),     // e.g. "Tangent", "Angle", "Dead End"
  span:        text('span'),                     // e.g. "A-B", "250m"
  workStage:   text('work_stage').notNull().default('FOUNDATION'),
  notes:       text('notes'),
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:   text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export type SiteLocation = typeof siteLocations.$inferSelect

// ── Site Work Status ──────────────────────────────────────────
export const siteWorkStatus = sqliteTable('site_work_status', {
  id:               text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:           text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }).unique(),
  workStage:        text('work_stage').notNull().default('FOUNDATION'), // FOUNDATION | ERECTION | STRINGING | FINISHING | COMPLETED
  attendanceMethod: text('attendance_method').notNull().default('INDIVIDUAL'), // INDIVIDUAL | TEAM
  updatedAt:        text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ── New Type exports ──────────────────────────────────────────
export type Cashbook       = typeof cashbooks.$inferSelect
export type CashbookEntry  = typeof cashbookEntries.$inferSelect
export type LabourTeam     = typeof labourTeams.$inferSelect
export type TeamMember     = typeof teamMembers.$inferSelect
export type SiteWorkStatus = typeof siteWorkStatus.$inferSelect


// ── Custom Fields (per cashbook) ─────────────────────────────
export const cashbookCustomFields = sqliteTable('cashbook_custom_fields', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cashbookId:   text('cashbook_id').notNull().references(() => cashbooks.id, { onDelete: 'cascade' }),
  label:        text('label').notNull(),
  fieldType:    text('field_type').notNull().default('TEXT'),
  options:      text('options'),
  required:     integer('required', { mode: 'boolean' }).notNull().default(false),
  sortOrder:    integer('sort_order').notNull().default(0),
  createdAt:    text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ── Custom Payment Methods (per site) ─────────────────────────
export const customPaymentMethods = sqliteTable('custom_payment_methods', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ── Cashbook Access ────────────────────────────────────────────
export const cashbookAccess = sqliteTable('cashbook_access', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cashbookId:   text('cashbook_id').notNull().references(() => cashbooks.id, { onDelete: 'cascade' }),
  email:        text('email').notNull(),
  name:         text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type CashbookCustomField = typeof cashbookCustomFields.$inferSelect
export type CustomPaymentMethod = typeof customPaymentMethods.$inferSelect
export type CashbookAccess      = typeof cashbookAccess.$inferSelect

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
