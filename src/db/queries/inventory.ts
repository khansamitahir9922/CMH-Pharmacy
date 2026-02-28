import { eq, and, like, desc } from 'drizzle-orm'
import { getDb } from '../init'
import { medicines, medicineCategories, stock, stockTransactions, users } from '../schema'
import dayjs from 'dayjs'

export interface InventorySummary {
  totalMedicines: number
  totalStockUnits: number
  lowStock: number
  expiringThisMonth: number
  expired: number
}

export interface MedicineStockRow {
  id: number
  name: string
  category_name: string | null
  batch_no: string | null
  expiry_date: string | null
  current_quantity: number
  min_stock_level: number
}

export interface RecordTransactionInput {
  medicineId: number
  type: 'in' | 'out' | 'adjust'
  quantity: number
  reason: string
  date: string
  notes: string | null
  performedBy: number | null
}

export interface GetTransactionsFilters {
  medicineId?: number | null
  startDate?: string | null
  endDate?: string | null
  page?: number
  pageSize?: number
}

export interface TransactionRow {
  id: number
  medicine_id: number
  transaction_type: 'in' | 'out' | 'adjust' | 'return'
  quantity: number
  reason: string | null
  created_at: string
  performed_by: number | null
  medicine_name: string | null
  batch_no: string | null
  performer_name: string | null
}

const today = (): string => dayjs().format('YYYY-MM-DD')
const addDays = (days: number): string => dayjs().add(days, 'day').format('YYYY-MM-DD')

/**
 * Get inventory summary counts (active medicines, low stock, expiring within 30 days, expired).
 */
export function getSummary(): InventorySummary {
  const db = getDb()
  const rows = db
    .select({
      id: medicines.id,
      expiry_date: medicines.expiry_date,
      current_quantity: stock.current_quantity,
      min_stock_level: medicines.min_stock_level
    })
    .from(medicines)
    .leftJoin(stock, eq(medicines.id, stock.medicine_id))
    .where(eq(medicines.is_deleted, false))
    .all() as { id: number; expiry_date: string | null; current_quantity: number | null; min_stock_level: number }[]

  const t = today()
  const t30 = addDays(30)

  let totalMedicines = rows.length
  let totalStockUnits = 0
  let lowStock = 0
  let expiringThisMonth = 0
  let expired = 0

  for (const r of rows) {
    const qty = r.current_quantity ?? 0
    totalStockUnits += qty
    const min = r.min_stock_level ?? 0
    if (qty < min) lowStock++
    const exp = r.expiry_date
    if (exp) {
      if (exp < t) expired++
      else if (exp <= t30) expiringThisMonth++
    }
  }

  return { totalMedicines, totalStockUnits, lowStock, expiringThisMonth, expired }
}

/**
 * Get medicines where current_quantity < min_stock_level (top N).
 */
export function getLowStock(limit = 10): MedicineStockRow[] {
  const db = getDb()
  const rows = db
    .select({
      id: medicines.id,
      name: medicines.name,
      batch_no: medicines.batch_no,
      expiry_date: medicines.expiry_date,
      min_stock_level: medicines.min_stock_level,
      category_name: medicineCategories.name,
      current_quantity: stock.current_quantity
    })
    .from(medicines)
    .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
    .leftJoin(stock, eq(medicines.id, stock.medicine_id))
    .where(eq(medicines.is_deleted, false))
    .all() as { id: number; name: string; batch_no: string | null; expiry_date: string | null; min_stock_level: number; category_name: string | null; current_quantity: number | null }[]

  const low = rows.filter((r) => (r.current_quantity ?? 0) < (r.min_stock_level ?? 0))
  return low.slice(0, limit).map((r) => ({
    id: r.id,
    name: r.name,
    category_name: r.category_name ?? null,
    batch_no: r.batch_no ?? null,
    expiry_date: r.expiry_date ?? null,
    current_quantity: r.current_quantity ?? 0,
    min_stock_level: r.min_stock_level ?? 0
  }))
}

/**
 * Get medicines expiring within N days (or already expired if days is large), sorted by expiry date ascending.
 * Use days=90 and includeExpired=true for "Expiring Soon" table (expired + up to 90 days).
 */
export function getExpiringSoon(days: number, limit = 10, includeExpired = true): MedicineStockRow[] {
  const db = getDb()
  const t = today()
  const tEnd = addDays(Math.max(days, 0))
  const rows = db
    .select({
      id: medicines.id,
      name: medicines.name,
      batch_no: medicines.batch_no,
      expiry_date: medicines.expiry_date,
      min_stock_level: medicines.min_stock_level,
      category_name: medicineCategories.name,
      current_quantity: stock.current_quantity
    })
    .from(medicines)
    .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
    .leftJoin(stock, eq(medicines.id, stock.medicine_id))
    .where(eq(medicines.is_deleted, false))
    .all() as { id: number; name: string; batch_no: string | null; expiry_date: string | null; min_stock_level: number; category_name: string | null; current_quantity: number | null }[]

  const expiring = rows.filter((r) => {
    const exp = r.expiry_date
    if (!exp) return false
    if (includeExpired && exp < t) return true
    return exp >= t && exp <= tEnd
  })
  expiring.sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
  return expiring.slice(0, limit).map((r) => ({
    id: r.id,
    name: r.name,
    category_name: r.category_name ?? null,
    batch_no: r.batch_no ?? null,
    expiry_date: r.expiry_date ?? null,
    current_quantity: r.current_quantity ?? 0,
    min_stock_level: r.min_stock_level ?? 0
  }))
}

/**
 * Get medicines past expiry date.
 */
export function getExpired(limit = 100): MedicineStockRow[] {
  const db = getDb()
  const t = today()
  const rows = db
    .select({
      id: medicines.id,
      name: medicines.name,
      batch_no: medicines.batch_no,
      expiry_date: medicines.expiry_date,
      min_stock_level: medicines.min_stock_level,
      category_name: medicineCategories.name,
      current_quantity: stock.current_quantity
    })
    .from(medicines)
    .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
    .leftJoin(stock, eq(medicines.id, stock.medicine_id))
    .where(eq(medicines.is_deleted, false))
    .all() as { id: number; name: string; batch_no: string | null; expiry_date: string | null; min_stock_level: number; category_name: string | null; current_quantity: number | null }[]

  const expired = rows.filter((r) => r.expiry_date && r.expiry_date < t)
  return expired.map((r) => ({
    id: r.id,
    name: r.name,
    category_name: r.category_name ?? null,
    batch_no: r.batch_no ?? null,
    expiry_date: r.expiry_date ?? null,
    current_quantity: r.current_quantity ?? 0,
    min_stock_level: r.min_stock_level ?? 0
  }))
}

/**
 * Record a stock transaction and update stock. For 'out' and 'adjust', quantity is subtracted.
 * Validates that 'out' does not reduce stock below 0.
 */
export function recordTransaction(input: RecordTransactionInput): void {
  const db = getDb()
  const { medicineId, type, quantity, reason, date, notes, performedBy } = input
  if (quantity <= 0) throw new Error('Quantity must be greater than 0.')

  const stockRow = db.select().from(stock).where(eq(stock.medicine_id, medicineId)).limit(1).all()[0]
  if (!stockRow) throw new Error('Medicine stock record not found.')

  const currentQty = stockRow.current_quantity ?? 0
  const delta = type === 'in' ? quantity : -quantity
  if (type !== 'in' && currentQty + delta < 0) {
    throw new Error(`Insufficient stock. Current: ${currentQty}, requested: ${quantity}.`)
  }

  const newQty = currentQty + delta
  const now = dayjs().toISOString()

  db.insert(stockTransactions).values({
    medicine_id: medicineId,
    transaction_type: type,
    quantity,
    reason: reason || null,
    performed_by: performedBy,
    created_at: date ? dayjs(date).toISOString() : now
  }).run()

  db.update(stock)
    .set({ current_quantity: newQty, updated_at: now })
    .where(eq(stock.medicine_id, medicineId))
    .run()
}

/**
 * Get transaction history with optional filters and pagination.
 */
export function getTransactions(filters: GetTransactionsFilters): { data: TransactionRow[]; total: number } {
  const db = getDb()
  const {
    medicineId = null,
    startDate = null,
    endDate = null,
    page = 1,
    pageSize = 20
  } = filters

  const conditions: ReturnType<typeof eq>[] = []
  if (medicineId != null && medicineId > 0) {
    conditions.push(eq(stockTransactions.medicine_id, medicineId))
  }
  const whereClause = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions)

  const baseQuery = db
    .select({
      id: stockTransactions.id,
      medicine_id: stockTransactions.medicine_id,
      transaction_type: stockTransactions.transaction_type,
      quantity: stockTransactions.quantity,
      reason: stockTransactions.reason,
      created_at: stockTransactions.created_at,
      performed_by: stockTransactions.performed_by,
      medicine_name: medicines.name,
      batch_no: medicines.batch_no,
      performer_name: users.full_name
    })
    .from(stockTransactions)
    .leftJoin(medicines, eq(stockTransactions.medicine_id, medicines.id))
    .leftJoin(users, eq(stockTransactions.performed_by, users.id))

  const q = whereClause ? baseQuery.where(whereClause) : baseQuery
  const allRows = q.orderBy(desc(stockTransactions.created_at)).all() as (TransactionRow & { created_at: string })[]

  let filtered = allRows
  if (startDate || endDate) {
    filtered = allRows.filter((r) => {
      const d = r.created_at?.slice(0, 10)
      if (startDate && d < startDate) return false
      if (endDate && d > endDate) return false
      return true
    })
  }

  const total = filtered.length
  const offset = (page - 1) * pageSize
  const data = filtered.slice(offset, offset + pageSize).map((r) => ({
    id: r.id,
    medicine_id: r.medicine_id,
    transaction_type: r.transaction_type,
    quantity: r.quantity,
    reason: r.reason ?? null,
    created_at: r.created_at,
    performed_by: r.performed_by ?? null,
    medicine_name: r.medicine_name ?? null,
    batch_no: r.batch_no ?? null,
    performer_name: r.performer_name ?? null
  }))

  return { data, total }
}

export type ExpiryReportStatus = 'expired' | 'warning30' | 'warning90' | 'ok'

export interface ExpiryReportRow {
  id: number
  name: string
  category_name: string | null
  batch_no: string | null
  expiry_date: string | null
  current_quantity: number
  days_left: number | null
  status: ExpiryReportStatus
}

/**
 * Get all medicines with expiry status for report, grouped by status.
 */
export function getExpiryReport(): {
  expired: ExpiryReportRow[]
  warning30: ExpiryReportRow[]
  warning90: ExpiryReportRow[]
  ok: ExpiryReportRow[]
} {
  const db = getDb()
  const t = today()
  const t30 = addDays(30)
  const t90 = addDays(90)

  const rows = db
    .select({
      id: medicines.id,
      name: medicines.name,
      batch_no: medicines.batch_no,
      expiry_date: medicines.expiry_date,
      category_name: medicineCategories.name,
      current_quantity: stock.current_quantity
    })
    .from(medicines)
    .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
    .leftJoin(stock, eq(medicines.id, stock.medicine_id))
    .where(eq(medicines.is_deleted, false))
    .all() as { id: number; name: string; batch_no: string | null; expiry_date: string | null; category_name: string | null; current_quantity: number | null }[]

  const toRow = (r: (typeof rows)[0], status: ExpiryReportStatus, daysLeft: number | null): ExpiryReportRow => ({
    id: r.id,
    name: r.name,
    category_name: r.category_name ?? null,
    batch_no: r.batch_no ?? null,
    expiry_date: r.expiry_date ?? null,
    current_quantity: r.current_quantity ?? 0,
    days_left: daysLeft,
    status
  })

  const expired: ExpiryReportRow[] = []
  const warning30: ExpiryReportRow[] = []
  const warning90: ExpiryReportRow[] = []
  const ok: ExpiryReportRow[] = []

  for (const r of rows) {
    const exp = r.expiry_date
    if (!exp) {
      ok.push(toRow(r, 'ok', null))
      continue
    }
    const daysLeft = dayjs(exp).startOf('day').diff(dayjs(t).startOf('day'), 'day')
    if (exp < t) expired.push(toRow(r, 'expired', daysLeft))
    else if (exp <= t30) warning30.push(toRow(r, 'warning30', daysLeft))
    else if (exp <= t90) warning90.push(toRow(r, 'warning90', daysLeft))
    else ok.push(toRow(r, 'ok', daysLeft))
  }

  expired.sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
  warning30.sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
  warning90.sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
  ok.sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))

  return { expired, warning30, warning90, ok }
}
