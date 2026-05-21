export type Role = 'ADMIN' | 'SUPERVISOR'
export type SiteStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'PLANNING'
export type MaterialLogType = 'PURCHASE' | 'USAGE' | 'RETURN' | 'ADJUSTMENT'
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY'
export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'NEFT' | 'RTGS' | 'CHEQUE'
export type AccountingType = 'INCOME' | 'EXPENSE'
export type LPOStatus = 'PENDING' | 'APPROVED' | 'RECEIVED' | 'CANCELLED'
export type PayrollStatus = 'PENDING' | 'PAID' | 'PARTIAL'
export type LabourStatus = 'ACTIVE' | 'INACTIVE'

export interface Site {
  id: string
  name: string
  location: string
  description?: string | null
  status: SiteStatus
  startDate: Date | string
  endDate?: Date | string | null
  budget: number
  createdAt: Date | string
}

export interface WorkLog {
  id: string
  siteId: string
  userId: string
  workTypeId: string
  description?: string | null
  quantity: number
  unit: string
  date: Date | string
  synced: boolean
  workType?: { name: string; unit: string }
  user?: { name: string }
}

export interface Material {
  id: string
  siteId: string
  name: string
  unit: string
}

export interface MaterialLog {
  id: string
  siteId: string
  materialId: string
  type: MaterialLogType
  quantity: number
  unitPrice?: number | null
  notes?: string | null
  date: Date | string
  synced: boolean
  material?: { name: string; unit: string }
}

export interface Labour {
  id: string
  siteId: string
  name: string
  phone?: string | null
  trade: string
  dailyWage: number
  status: LabourStatus
  joinDate: Date | string
}

export interface Attendance {
  id: string
  siteId: string
  labourId: string
  userId: string
  date: Date | string
  status: AttendanceStatus
  halfDay: boolean
  overtime?: number | null
  notes?: string | null
  synced: boolean
  labour?: { name: string; trade: string }
}

export interface Accounting {
  id: string
  siteId: string
  type: AccountingType
  category: string
  amount: number
  description: string
  paymentMode: PaymentMode
  reference?: string | null
  date: Date | string
  invoiceNo?: string | null
}

export interface IdealRule {
  id: string
  siteId: string
  workTypeId: string
  materialId: string
  idealQtyPer: number
  description?: string | null
  workType?: { name: string; unit: string }
  material?: { name: string; unit: string }
}

export interface VarianceReport {
  materialId: string
  materialName: string
  unit: string
  idealUsage: number
  actualUsage: number
  variance: number
  variancePercent: number
  status: 'OVER' | 'UNDER' | 'ON_TRACK'
}

export interface SiteDashboard {
  site: Site
  totalWorkLogs: number
  totalLabour: number
  presentToday: number
  totalExpense: number
  totalIncome: number
  materialVariances: VarianceReport[]
  recentActivity: (WorkLog | MaterialLog | Attendance)[]
}

export interface MasterDashboard {
  totalSites: number
  activeSites: number
  totalBudget: number
  totalExpense: number
  totalIncome: number
  profit: number
  alerts: Alert[]
  sitesSummary: SiteSummary[]
}

export interface Alert {
  id: string
  siteId: string
  siteName: string
  type: 'OVER_USAGE' | 'BUDGET_EXCEEDED' | 'ATTENDANCE_LOW'
  message: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  createdAt: string
}

export interface SiteSummary {
  id: string
  name: string
  location: string
  status: SiteStatus
  budget: number
  spent: number
  budgetPercent: number
  labourCount: number
  presentToday: number
  alerts: number
}
