import { sql } from 'drizzle-orm'
import {
  pgTable,
  text,
  boolean,
  doublePrecision,
  integer,
  unique,
} from 'drizzle-orm/pg-core'

const ts = sql`CURRENT_TIMESTAMP::text`

// ── Users ─────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email:        text('email').notNull().unique(),
  name:         text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role').notNull().default('SUPERVISOR'),
  phone:        text('phone'),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    text('created_at').notNull().default(ts),
  updatedAt:    text('updated_at').notNull().default(ts),
})

// ── Sites ─────────────────────────────────────────────────────
export const sites = pgTable('sites', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:        text('name').notNull(),
  location:    text('location').notNull(),
  description: text('description'),
  status:      text('status').notNull().default('ACTIVE'),
  startDate:   text('start_date').notNull(),
  endDate:     text('end_date'),
  budget:      doublePrecision('budget').notNull().default(0),
  createdById: text('created_by_id').notNull().references(() => users.id),
  createdAt:   text('created_at').notNull().default(ts),
  updatedAt:   text('updated_at').notNull().default(ts),
})

// ── Site Access ───────────────────────────────────────────────
export const siteAccess = pgTable('site_access', {
  id:     text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
}, (t) => ({ uniq: unique().on(t.userId, t.siteId) }))

// ── Work Types ────────────────────────────────────────────────
export const workTypes = pgTable('work_types', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  unit:      text('unit').notNull(),
  createdAt: text('created_at').notNull().default(ts),
})

// ── Work Logs ─────────────────────────────────────────────────
export const workLogs = pgTable('work_logs', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  userId:      text('user_id').notNull().references(() => users.id),
  workTypeId:  text('work_type_id').notNull().references(() => workTypes.id),
  description: text('description'),
  quantity:    doublePrecision('quantity').notNull(),
  unit:        text('unit').notNull(),
  date:        text('date').notNull(),
  synced:      boolean('synced').notNull().default(true),
  offlineId:   text('offline_id').unique(),
  createdAt:   text('created_at').notNull().default(ts),
})

// ── Materials ─────────────────────────────────────────────────
export const materials = pgTable('materials', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  unit:      text('unit').notNull(),
  createdAt: text('created_at').notNull().default(ts),
})

// ── Material Logs ─────────────────────────────────────────────
export const materialLogs = pgTable('material_logs', {
  id:         text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:     text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  materialId: text('material_id').notNull().references(() => materials.id),
  type:       text('type').notNull(),
  quantity:   doublePrecision('quantity').notNull(),
  unitPrice:  doublePrecision('unit_price'),
  notes:      text('notes'),
  date:       text('date').notNull(),
  synced:     boolean('synced').notNull().default(true),
  offlineId:  text('offline_id').unique(),
  createdAt:  text('created_at').notNull().default(ts),
})

// ── Ideal Rules ───────────────────────────────────────────────
export const idealRules = pgTable('ideal_rules', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  workTypeId:  text('work_type_id').notNull().references(() => workTypes.id),
  materialId:  text('material_id').notNull().references(() => materials.id),
  idealQtyPer: doublePrecision('ideal_qty_per').notNull(),
  description: text('description'),
  createdAt:   text('created_at').notNull().default(ts),
  updatedAt:   text('updated_at').notNull().default(ts),
})

// ── Labour ────────────────────────────────────────────────────
export const labour = pgTable('labour', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  phone:     text('phone'),
  trade:     text('trade').notNull(),
  dailyWage: doublePrecision('daily_wage').notNull(),
  status:    text('status').notNull().default('ACTIVE'),
  joinDate:  text('join_date').notNull(),
  createdAt: text('created_at').notNull().default(ts),
  updatedAt: text('updated_at').notNull().default(ts),
})

// ── Attendance ────────────────────────────────────────────────
export const attendance = pgTable('attendance', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  labourId:  text('labour_id').notNull().references(() => labour.id),
  userId:    text('user_id').notNull().references(() => users.id),
  date:      text('date').notNull(),
  status:    text('status').notNull(),
  halfDay:   boolean('half_day').notNull().default(false),
  overtime:  doublePrecision('overtime'),
  notes:     text('notes'),
  synced:    boolean('synced').notNull().default(true),
  offlineId: text('offline_id').unique(),
  createdAt: text('created_at').notNull().default(ts),
}, (t) => ({ uniqLabourDate: unique().on(t.labourId, t.date) }))

// ── Payroll ───────────────────────────────────────────────────
export const payroll = pgTable('payroll', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  labourId:    text('labour_id').notNull().references(() => labour.id),
  periodStart: text('period_start').notNull(),
  periodEnd:   text('period_end').notNull(),
  totalDays:   doublePrecision('total_days').notNull(),
  dailyWage:   doublePrecision('daily_wage').notNull(),
  overtime:    doublePrecision('overtime').notNull().default(0),
  deductions:  doublePrecision('deductions').notNull().default(0),
  netAmount:   doublePrecision('net_amount').notNull(),
  status:      text('status').notNull().default('PENDING'),
  paidAt:      text('paid_at'),
  paymentMode: text('payment_mode'),
  notes:       text('notes'),
  createdAt:   text('created_at').notNull().default(ts),
})

// ── Accounting ────────────────────────────────────────────────
export const accounting = pgTable('accounting', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  type:        text('type').notNull(),
  category:    text('category').notNull(),
  amount:      doublePrecision('amount').notNull(),
  description: text('description').notNull(),
  paymentMode: text('payment_mode').notNull(),
  reference:   text('reference'),
  date:        text('date').notNull(),
  invoiceNo:   text('invoice_no'),
  lpoId:       text('lpo_id'),
  createdAt:   text('created_at').notNull().default(ts),
  updatedAt:   text('updated_at').notNull().default(ts),
})

// ── LPOs ─────────────────────────────────────────────────────
export const lpos = pgTable('lpos', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  lpoNumber:   text('lpo_number').notNull().unique(),
  vendor:      text('vendor').notNull(),
  description: text('description').notNull(),
  amount:      doublePrecision('amount').notNull(),
  status:      text('status').notNull().default('PENDING'),
  issueDate:   text('issue_date').notNull(),
  dueDate:     text('due_date'),
  createdAt:   text('created_at').notNull().default(ts),
})

// ── Cashbooks ─────────────────────────────────────────────────
export const cashbooks = pgTable('cashbooks', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:      text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  description: text('description'),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   text('created_at').notNull().default(ts),
  updatedAt:   text('updated_at').notNull().default(ts),
})

// ── Cashbook Entries ──────────────────────────────────────────
export const cashbookEntries = pgTable('cashbook_entries', {
  id:                text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cashbookId:        text('cashbook_id').notNull().references(() => cashbooks.id, { onDelete: 'cascade' }),
  siteId:            text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  type:              text('type').notNull(),
  category:          text('category').notNull(),
  amount:            doublePrecision('amount').notNull(),
  description:       text('description').notNull(),
  paymentMode:       text('payment_mode').notNull(),
  reference:         text('reference'),
  vendor:            text('vendor'),
  date:              text('date').notNull(),
  lpoNumber:         text('lpo_number'),
  lpoStatus:         text('lpo_status'),
  partyName:         text('party_name'),
  proofUrl:          text('proof_url'),
  customFieldValues: text('custom_field_values'),
  createdAt:         text('created_at').notNull().default(ts),
  updatedAt:         text('updated_at'),
})

// ── Parties ───────────────────────────────────────────────────
export const parties = pgTable('parties', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  type:      text('type'),
  phone:     text('phone'),
  createdAt: text('created_at').notNull().default(ts),
})

export type Party = typeof parties.$inferSelect

// ── Labour Teams ──────────────────────────────────────────────
export const labourTeams = pgTable('labour_teams', {
  id:               text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:           text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:             text('name').notNull(),
  attendanceMethod: text('attendance_method').notNull().default('INDIVIDUAL'),
  createdAt:        text('created_at').notNull().default(ts),
  updatedAt:        text('updated_at').notNull().default(ts),
})

// ── Team Members ──────────────────────────────────────────────
export const teamMembers = pgTable('team_members', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  teamId:    text('team_id').notNull().references(() => labourTeams.id, { onDelete: 'cascade' }),
  labourId:  text('labour_id').notNull().references(() => labour.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(ts),
}, (t) => ({ uniq: unique().on(t.teamId, t.labourId) }))

// ── Site Locations ────────────────────────────────────────────
export const siteLocations = pgTable('site_locations', {
  id:         text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:     text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  locationNo: text('location_no').notNull(),
  towerType:  text('tower_type').notNull(),
  span:       text('span'),
  workStage:  text('work_stage').notNull().default('FOUNDATION'),
  notes:      text('notes'),
  createdAt:  text('created_at').notNull().default(ts),
  updatedAt:  text('updated_at').notNull().default(ts),
})

export type SiteLocation = typeof siteLocations.$inferSelect

// ── Site Work Status ──────────────────────────────────────────
export const siteWorkStatus = pgTable('site_work_status', {
  id:               text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:           text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }).unique(),
  workStage:        text('work_stage').notNull().default('FOUNDATION'),
  attendanceMethod: text('attendance_method').notNull().default('INDIVIDUAL'),
  updatedAt:        text('updated_at').notNull().default(ts),
})

// ── Custom Fields (per cashbook) ─────────────────────────────
export const cashbookCustomFields = pgTable('cashbook_custom_fields', {
  id:         text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cashbookId: text('cashbook_id').notNull().references(() => cashbooks.id, { onDelete: 'cascade' }),
  label:      text('label').notNull(),
  fieldType:  text('field_type').notNull().default('TEXT'),
  options:    text('options'),
  required:   boolean('required').notNull().default(false),
  sortOrder:  integer('sort_order').notNull().default(0),
  createdAt:  text('created_at').notNull().default(ts),
})

// ── Custom Payment Methods (per site) ─────────────────────────
export const customPaymentMethods = pgTable('custom_payment_methods', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId:    text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  createdAt: text('created_at').notNull().default(ts),
})

// ── Cashbook Access ────────────────────────────────────────────
export const cashbookAccess = pgTable('cashbook_access', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cashbookId:   text('cashbook_id').notNull().references(() => cashbooks.id, { onDelete: 'cascade' }),
  email:        text('email').notNull(),
  name:         text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    text('created_at').notNull().default(ts),
})

export type Cashbook       = typeof cashbooks.$inferSelect
export type CashbookEntry  = typeof cashbookEntries.$inferSelect
export type LabourTeam     = typeof labourTeams.$inferSelect
export type TeamMember     = typeof teamMembers.$inferSelect
export type SiteWorkStatus = typeof siteWorkStatus.$inferSelect
export type CashbookCustomField = typeof cashbookCustomFields.$inferSelect
export type CustomPaymentMethod = typeof customPaymentMethods.$inferSelect
export type CashbookAccess      = typeof cashbookAccess.$inferSelect

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
