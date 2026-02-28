import { eq, and, like, or } from 'drizzle-orm'
import { getDb, getSqlite } from '../init'
import { medicines, medicineCategories, stock, stockTransactions } from '../schema'
import dayjs from 'dayjs'

export interface MedicineRow {
  id: number
  name: string
  category_id: number | null
  batch_no: string | null
  barcode: string | null
  mfg_date: string | null
  expiry_date: string | null
  received_date: string | null
  order_date: string | null
  firm_name: string | null
  opening_stock: number
  unit_price_buy: number
  unit_price_sell: number
  min_stock_level: number
  shelf_location: string | null
  notes: string | null
  is_deleted: number
  created_at: string
  updated_at: string
}

export interface MedicineWithStock extends MedicineRow {
  category_name: string | null
  current_quantity: number
}

export interface GetAllFilters {
  search?: string
  categoryId?: number | null
  expiryStatus?: 'all' | 'expired' | 'warning30' | 'warning90' | 'ok'
  stockStatus?: 'all' | 'low' | 'out'
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'expiry_date' | 'current_quantity'
  sortOrder?: 'asc' | 'desc'
}

const today = (): string => dayjs().format('YYYY-MM-DD')
const addDays = (days: number): string => dayjs().add(days, 'day').format('YYYY-MM-DD')

/**
 * Get paginated medicines with filters, joined with category and stock.
 */
export function getAll(filters: GetAllFilters): { data: MedicineWithStock[]; total: number } {
  const db = getDb()
  const {
    search = '',
    categoryId = null,
    expiryStatus = 'all',
    stockStatus = 'all',
    page = 1,
    pageSize = 20,
    sortBy = 'name',
    sortOrder = 'asc'
  } = filters

  const searchTerm = `%${String(search).trim()}%`
  const offset = (page - 1) * pageSize

  // Base conditions: not deleted (schema uses boolean mode)
  const conditions = [
    eq(medicines.is_deleted, false),
    ...(categoryId != null && categoryId > 0 ? [eq(medicines.category_id, categoryId)] : []),
    ...(searchTerm !== '%%' ? [or(like(medicines.name, searchTerm), like(medicines.batch_no, searchTerm))!] : [])
  ]
  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)
  const query = db
    .select({
      id: medicines.id,
      name: medicines.name,
      category_id: medicines.category_id,
      batch_no: medicines.batch_no,
      mfg_date: medicines.mfg_date,
      expiry_date: medicines.expiry_date,
      received_date: medicines.received_date,
      order_date: medicines.order_date,
      firm_name: medicines.firm_name,
      opening_stock: medicines.opening_stock,
      unit_price_buy: medicines.unit_price_buy,
      unit_price_sell: medicines.unit_price_sell,
      min_stock_level: medicines.min_stock_level,
      shelf_location: medicines.shelf_location,
      notes: medicines.notes,
      is_deleted: medicines.is_deleted,
      created_at: medicines.created_at,
      updated_at: medicines.updated_at,
      category_name: medicineCategories.name,
      current_quantity: stock.current_quantity
    })
    .from(medicines)
    .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
    .leftJoin(stock, eq(medicines.id, stock.medicine_id))
    .where(whereClause)

  const allRows = query.all() as unknown as (MedicineRow & { category_name: string | null; current_quantity: number | null })[]

  // Filter by expiry status (date-based)
  const filteredByExpiry = allRows.filter((row) => {
    if (expiryStatus === 'all') return true
    const exp = row.expiry_date
    if (!exp) return expiryStatus === 'ok'
    const t = today()
    const t30 = addDays(30)
    const t90 = addDays(90)
    if (expiryStatus === 'expired') return exp < t
    if (expiryStatus === 'warning30') return exp >= t && exp <= t30
    if (expiryStatus === 'warning90') return exp > t30 && exp <= t90
    if (expiryStatus === 'ok') return exp > t90
    return true
  })

  // Filter by stock status
  const filtered = filteredByExpiry.filter((row) => {
    if (stockStatus === 'all') return true
    const qty = row.current_quantity ?? 0
    const min = row.min_stock_level ?? 0
    if (stockStatus === 'out') return qty === 0
    if (stockStatus === 'low') return qty > 0 && qty <= min
    return true
  })

  const total = filtered.length

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'name') {
      cmp = (a.name ?? '').localeCompare(b.name ?? '')
    } else if (sortBy === 'expiry_date') {
      const da = a.expiry_date ?? ''
      const db = b.expiry_date ?? ''
      cmp = da.localeCompare(db)
    } else if (sortBy === 'current_quantity') {
      const qa = a.current_quantity ?? 0
      const qb = b.current_quantity ?? 0
      cmp = qa - qb
    }
    return sortOrder === 'desc' ? -cmp : cmp
  })

  const data = sorted.slice(offset, offset + pageSize).map((row) => {
    const r = row as unknown as { is_deleted?: boolean; [k: string]: unknown }
    return {
      ...row,
      is_deleted: r.is_deleted ? 1 : 0,
      current_quantity: row.current_quantity ?? 0,
      category_name: row.category_name ?? null
    }
  })

  return { data, total }
}

/**
 * Get a single medicine by ID with stock and category name.
 */
export function getById(id: number): MedicineWithStock | null {
  const db = getDb()
  const rows = db
    .select({
      id: medicines.id,
      name: medicines.name,
      category_id: medicines.category_id,
      batch_no: medicines.batch_no,
      barcode: medicines.barcode,
      mfg_date: medicines.mfg_date,
      expiry_date: medicines.expiry_date,
      received_date: medicines.received_date,
      order_date: medicines.order_date,
      firm_name: medicines.firm_name,
      opening_stock: medicines.opening_stock,
      unit_price_buy: medicines.unit_price_buy,
      unit_price_sell: medicines.unit_price_sell,
      min_stock_level: medicines.min_stock_level,
      shelf_location: medicines.shelf_location,
      notes: medicines.notes,
      is_deleted: medicines.is_deleted,
      created_at: medicines.created_at,
      updated_at: medicines.updated_at,
      category_name: medicineCategories.name,
      current_quantity: stock.current_quantity
    })
    .from(medicines)
    .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
    .leftJoin(stock, eq(medicines.id, stock.medicine_id))
    .where(eq(medicines.id, id))
    .limit(1)
    .all()
  const row = rows[0]
  if (!row || row.is_deleted) return null
  return {
    ...row,
    is_deleted: row.is_deleted ? 1 : 0,
    current_quantity: row.current_quantity ?? 0,
    category_name: row.category_name ?? null
  } as MedicineWithStock
}

export interface CreateMedicineInput {
  name: string
  category_id: number | null
  batch_no: string
  barcode: string | null
  mfg_date: string
  expiry_date: string
  received_date: string
  order_date: string | null
  firm_name: string
  shelf_location: string | null
  opening_stock: number
  unit_price_buy: number
  unit_price_sell: number
  min_stock_level: number
  notes: string | null
}

/**
 * Create medicine, stock row, and opening stock transaction.
 */
export function create(input: CreateMedicineInput): { id: number } {
  const db = getDb()
  const now = dayjs().toISOString()
  const result = db
    .insert(medicines)
    .values({
      name: input.name,
      category_id: input.category_id,
      batch_no: input.batch_no,
      barcode: input.barcode ?? null,
      mfg_date: input.mfg_date,
      expiry_date: input.expiry_date,
      received_date: input.received_date,
      order_date: input.order_date,
      firm_name: input.firm_name,
      shelf_location: input.shelf_location,
      opening_stock: input.opening_stock,
      unit_price_buy: input.unit_price_buy,
      unit_price_sell: input.unit_price_sell,
      min_stock_level: input.min_stock_level,
      notes: input.notes,
      is_deleted: false,
      updated_at: now
    })
    .returning({ id: medicines.id })
    .all()
  const row = result[0]
  if (!row) throw new Error('Failed to create medicine')
  const medicineId = row.id

  db.insert(stock).values({
    medicine_id: medicineId,
    current_quantity: input.opening_stock,
    updated_at: now
  }).run()

  db.insert(stockTransactions).values({
    medicine_id: medicineId,
    transaction_type: 'in',
    quantity: input.opening_stock,
    reason: 'Opening Stock',
    created_at: now
  }).run()

  return { id: medicineId }
}

export interface UpdateMedicineInput extends Partial<CreateMedicineInput> {
  id: number
}

/**
 * Update medicine by ID. Does not change stock (use inventory for that).
 */
export function update(input: UpdateMedicineInput): void {
  const db = getDb()
  const { id, ...rest } = input
  const updates: Record<string, unknown> = { ...rest, updated_at: dayjs().toISOString() }
  db.update(medicines).set(updates as Record<string, string | number | null>).where(eq(medicines.id, id)).run()
}

/**
 * Soft-delete medicine (set is_deleted = true).
 */
export function remove(id: number): void {
  const db = getDb()
  db.update(medicines)
    .set({ is_deleted: true, updated_at: dayjs().toISOString() })
    .where(eq(medicines.id, id))
    .run()
}

/**
 * Get all medicine categories.
 */
export function getCategories(): { id: number; name: string }[] {
  const db = getDb()
  return db.select({ id: medicineCategories.id, name: medicineCategories.name }).from(medicineCategories).all()
}

const DUMMY_FIRMS = ['Sun Pharma', 'Cipla', 'Dr. Reddy\'s', 'Lupin', 'Zydus', 'Torrent', 'Cadila', 'Glenmark', 'Dummy Labs', 'Test Mfg Co']
const DUMMY_SHELVES = ['A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2']

/**
 * Seed dummy medicines (and stock rows) for load/performance testing.
 * Uses a single transaction and batch inserts; safe to call with 10000+.
 * @param count Number of dummy medicines to create (default 10000)
 * @returns Number of medicines inserted
 */
export function seedDummyMedicines(count = 10_000): number {
  const conn = getSqlite()
  const categories = getCategories()
  const categoryIds = categories.length > 0 ? categories.map((c) => c.id) : [null]

  const ins = conn.prepare(`
    INSERT INTO medicines (name, category_id, batch_no, barcode, mfg_date, expiry_date, received_date, order_date, firm_name, opening_stock, unit_price_buy, unit_price_sell, min_stock_level, shelf_location, notes, is_deleted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
  `)
  const stockIns = conn.prepare(`
    INSERT INTO stock (medicine_id, current_quantity, updated_at) VALUES (?, ?, datetime('now'))
  `)
  const txnIns = conn.prepare(`
    INSERT INTO stock_transactions (medicine_id, transaction_type, quantity, reason, created_at) VALUES (?, 'in', ?, 'Opening Stock', datetime('now'))
  `)

  const now = dayjs()
  const mfgDates = [
    now.subtract(18, 'month').format('YYYY-MM-DD'),
    now.subtract(12, 'month').format('YYYY-MM-DD'),
    now.subtract(6, 'month').format('YYYY-MM-DD')
  ]
  const expDates = [
    now.add(6, 'month').format('YYYY-MM-DD'),
    now.add(12, 'month').format('YYYY-MM-DD'),
    now.add(18, 'month').format('YYYY-MM-DD')
  ]

  conn.transaction(() => {
    for (let i = 0; i < count; i++) {
      const n = i + 1
      const name = `Dummy Medicine ${n}`
      const categoryId = categoryIds[i % categoryIds.length]
      const batchNo = `BATCH-${String(n).padStart(6, '0')}`
      const barcode = n % 3 === 0 ? `BAR${n}` : null
      const mfgDate = mfgDates[i % 3]
      const expDate = expDates[i % 3]
      const recvDate = now.subtract(i % 60, 'day').format('YYYY-MM-DD')
      const orderDate = now.subtract(i % 90, 'day').format('YYYY-MM-DD')
      const firm = DUMMY_FIRMS[i % DUMMY_FIRMS.length]
      const openingStock = 10 + (i % 491)
      const buy = 50 + (i % 450)
      const sell = Math.round(buy * (1.1 + (i % 20) / 100))
      const shelf = DUMMY_SHELVES[i % DUMMY_SHELVES.length]
      const notes = i % 5 === 0 ? `Test note for medicine ${n}` : null

      ins.run(name, categoryId, batchNo, barcode, mfgDate, expDate, recvDate, orderDate, firm, openingStock, buy, sell, 10, shelf, notes)
      const row = conn.prepare('SELECT last_insert_rowid() as id').get() as { id: number }
      const medicineId = row.id
      stockIns.run(medicineId, openingStock)
      txnIns.run(medicineId, openingStock)
    }
  })()

  return count
}

const searchSelect = {
  id: medicines.id,
  name: medicines.name,
  category_id: medicines.category_id,
  batch_no: medicines.batch_no,
  barcode: medicines.barcode,
  mfg_date: medicines.mfg_date,
  expiry_date: medicines.expiry_date,
  received_date: medicines.received_date,
  order_date: medicines.order_date,
  firm_name: medicines.firm_name,
  opening_stock: medicines.opening_stock,
  unit_price_buy: medicines.unit_price_buy,
  unit_price_sell: medicines.unit_price_sell,
  min_stock_level: medicines.min_stock_level,
  shelf_location: medicines.shelf_location,
  notes: medicines.notes,
  is_deleted: medicines.is_deleted,
  created_at: medicines.created_at,
  updated_at: medicines.updated_at,
  category_name: medicineCategories.name,
  current_quantity: stock.current_quantity
}

function mapSearchRow(r: Record<string, unknown>): MedicineWithStock {
  const row = r as unknown as { is_deleted?: boolean; [k: string]: unknown }
  return {
    ...r,
    is_deleted: row.is_deleted ? 1 : 0,
    current_quantity: (r.current_quantity as number) ?? 0,
    category_name: (r.category_name as string | null) ?? null
  } as MedicineWithStock
}

/**
 * Search medicines by name, batch, or barcode for POS (and barcode scan).
 * - Exact barcode or batch match (when term length >= 5) returns that single match.
 * - Otherwise fuzzy search on name, batch_no, barcode (top 10).
 */
export function search(term: string): MedicineWithStock[] {
  const trimmed = String(term).trim()
  if (!trimmed) return []
  const db = getDb()

  // Barcode / batch exact match: when user scans or types a full code (e.g. 8+ chars)
  if (trimmed.length >= 5) {
    const exactRows = db
      .select(searchSelect)
      .from(medicines)
      .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
      .leftJoin(stock, eq(medicines.id, stock.medicine_id))
      .where(
        and(
          eq(medicines.is_deleted, false),
          or(eq(medicines.barcode, trimmed), eq(medicines.batch_no, trimmed))!
        )
      )
      .limit(2)
      .all()
    if (exactRows.length === 1) return exactRows.map((r) => mapSearchRow(r as Record<string, unknown>))
  }

  const searchTerm = `%${trimmed}%`
  const rows = db
    .select(searchSelect)
    .from(medicines)
    .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
    .leftJoin(stock, eq(medicines.id, stock.medicine_id))
    .where(
      and(
        eq(medicines.is_deleted, false),
        or(
          like(medicines.name, searchTerm),
          like(medicines.batch_no, searchTerm),
          like(medicines.barcode, searchTerm)
        )!
      )
    )
    .limit(10)
    .all()
  return rows.map((r) => mapSearchRow(r as Record<string, unknown>))
}

/**
 * Return all non-deleted medicines with stock for Excel export.
 */
export function exportData(): MedicineWithStock[] {
  const { data } = getAll({ page: 1, pageSize: 999999 })
  return data
}
