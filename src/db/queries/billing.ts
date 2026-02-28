import dayjs from 'dayjs'
import { getDb, getSqlite } from '../init'
import { bills, billItems, medicines } from '../schema'
import { and, desc, eq, like, or, sql } from 'drizzle-orm'

export type PaymentMode = 'cash' | 'card' | 'credit'

export interface BillRow {
  id: number
  bill_number: string
  customer_name: string | null
  customer_phone: string | null
  subtotal: number
  discount_percent: number
  tax_percent: number
  total_amount: number
  payment_mode: PaymentMode
  amount_received: number
  change_due: number
  is_voided: boolean
  voided_reason: string | null
  voided_by: number | null
  created_by: number | null
  created_at: string
}

export interface BillItemRow {
  id: number
  bill_id: number
  medicine_id: number
  medicine_name: string | null
  batch_no: string | null
  quantity: number
  unit_price: number
  total: number
}

export interface CreateBillItemInput {
  medicineId: number
  quantity: number
  /** Unit price in paisa */
  unitPrice: number
}

export interface CreateBillInput {
  customerName?: string | null
  customerPhone?: string | null
  items: CreateBillItemInput[]
  discountPercent: number
  taxPercent: number
  paymentMode: PaymentMode
  /** Only for cash mode (paisa). */
  amountReceived?: number | null
  createdBy?: number | null
}

export interface BillDetailResult {
  bill: BillRow
  items: BillItemRow[]
}

export interface GetBillsFilters {
  startDate?: string | null
  endDate?: string | null
  customerSearch?: string | null
  paymentMode?: PaymentMode | null
  includeVoided?: boolean
  page?: number
  pageSize?: number
}

export interface BillListRow {
  id: number
  bill_number: string
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  items_count: number
  subtotal: number
  total_amount: number
  payment_mode: PaymentMode
  is_voided: boolean
}

export interface VoidBillInput {
  billId: number
  reason: string
  voidedBy: number
}

export interface DailySummary {
  date: string
  totalSales: number
  billCount: number
}

function toInt(n: unknown, fallback = 0): number {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? Math.trunc(v) : fallback
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

function computeDiscountAmount(subtotal: number, discountPercent: number): number {
  const pct = clampInt(discountPercent, 0, 100)
  return Math.round((subtotal * pct) / 100)
}

function computeTaxAmount(taxable: number, taxPercent: number): number {
  const pct = clampInt(taxPercent, 0, 100)
  return Math.round((taxable * pct) / 100)
}

function normalizePaymentMode(mode: string): PaymentMode {
  if (mode === 'card' || mode === 'credit') return mode
  return 'cash'
}

/**
 * Create a bill with items and update stock atomically.
 * Generates bill_number in format BILL-YYYYMMDD-XXXX (daily sequence).
 */
export function createBill(input: CreateBillInput): BillDetailResult {
  const sqlite = getSqlite()
  // Use local datetime so "today" in dashboard (local date) matches bill date
  const now = dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS')
  const datePart = dayjs().format('YYYYMMDD')
  const createdBy = input.createdBy ?? null

  const rawItems = Array.isArray(input.items) ? input.items : []
  if (rawItems.length === 0) throw new Error('Add at least one medicine to generate a bill.')

  const items = rawItems.map((it) => ({
    medicineId: toInt(it.medicineId),
    quantity: toInt(it.quantity),
    unitPrice: toInt(it.unitPrice)
  }))

  for (const it of items) {
    if (!it.medicineId || it.medicineId <= 0) throw new Error('Invalid medicine in bill items.')
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new Error('Quantity must be a positive whole number.')
    if (!Number.isInteger(it.unitPrice) || it.unitPrice < 0) throw new Error('Unit price must be a non-negative integer (paisa).')
  }

  const discountPercent = clampInt(input.discountPercent ?? 0, 0, 100)
  const taxPercent = clampInt(input.taxPercent ?? 0, 0, 100)
  const paymentMode = normalizePaymentMode(String(input.paymentMode ?? 'cash'))

  const customerName = input.customerName?.trim() ? String(input.customerName).trim() : null
  const customerPhone = input.customerPhone?.trim() ? String(input.customerPhone).trim() : null

  const tx = sqlite.transaction((): BillDetailResult => {
    // 1) Generate next bill number for today
    const last = sqlite
      .prepare(`SELECT bill_number FROM bills WHERE bill_number LIKE ? ORDER BY bill_number DESC LIMIT 1`)
      .get(`BILL-${datePart}-%`) as { bill_number?: string } | undefined
    const lastNumber = String(last?.bill_number ?? '')
    const lastSuffix = lastNumber.split('-').pop()
    const seq = (lastSuffix && /^\d+$/.test(lastSuffix)) ? parseInt(lastSuffix, 10) : 0
    const nextSeq = seq + 1
    const billNumber = `BILL-${datePart}-${String(nextSeq).padStart(4, '0')}`

    // 2) Validate stock + medicines (bulk)
    const uniqueIds = [...new Set(items.map((i) => i.medicineId))]
    const placeholders = uniqueIds.map(() => '?').join(',')
    const stockRows = sqlite
      .prepare(
        `
        SELECT 
          m.id               AS medicine_id,
          m.name             AS name,
          m.batch_no         AS batch_no,
          m.is_deleted       AS is_deleted,
          s.current_quantity AS current_quantity
        FROM medicines m
        LEFT JOIN stock s ON s.medicine_id = m.id
        WHERE m.id IN (${placeholders})
        `
      )
      .all(...uniqueIds) as Array<{
        medicine_id: number
        name: string
        batch_no: string | null
        is_deleted: number
        current_quantity: number | null
      }>

    const byId = new Map<number, { name: string; batch_no: string | null; is_deleted: number; current_quantity: number }>()
    for (const r of stockRows) {
      byId.set(r.medicine_id, {
        name: r.name,
        batch_no: r.batch_no ?? null,
        is_deleted: r.is_deleted ? 1 : 0,
        current_quantity: r.current_quantity ?? 0
      })
    }

    const required = new Map<number, number>()
    for (const it of items) {
      required.set(it.medicineId, (required.get(it.medicineId) ?? 0) + it.quantity)
    }

    for (const [medicineId, qtyNeeded] of required.entries()) {
      const info = byId.get(medicineId)
      if (!info) throw new Error(`Medicine not found (ID: ${medicineId}).`)
      if (info.is_deleted) throw new Error(`Cannot bill a deleted medicine: ${info.name}.`)
      if ((info.current_quantity ?? 0) < qtyNeeded) {
        throw new Error(`Insufficient stock for "${info.name}". Current: ${info.current_quantity ?? 0}, required: ${qtyNeeded}.`)
      }
    }

    // 3) Totals
    const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0)
    const discountAmount = computeDiscountAmount(subtotal, discountPercent)
    const taxable = Math.max(0, subtotal - discountAmount)
    const taxAmount = computeTaxAmount(taxable, taxPercent)
    const totalAmount = taxable + taxAmount

    let amountReceived = 0
    let changeDue = 0
    if (paymentMode === 'cash') {
      amountReceived = toInt(input.amountReceived ?? 0)
      if (amountReceived < totalAmount) {
        throw new Error('Amount received is less than total.')
      }
      changeDue = amountReceived - totalAmount
    } else {
      amountReceived = totalAmount
      changeDue = 0
    }

    // 4) Insert bill
    const billInsert = sqlite.prepare(`
      INSERT INTO bills (
        bill_number, customer_name, customer_phone,
        subtotal, discount_percent, tax_percent, total_amount,
        payment_mode, amount_received, change_due,
        created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const billRes = billInsert.run(
      billNumber,
      customerName,
      customerPhone,
      subtotal,
      discountPercent,
      taxPercent,
      totalAmount,
      paymentMode,
      amountReceived,
      changeDue,
      createdBy,
      now
    )
    const billId = Number(billRes.lastInsertRowid)
    if (!billId) throw new Error('Failed to create bill.')

    // 5) Insert bill items + stock transactions + update stock
    const insertItem = sqlite.prepare(`
      INSERT INTO bill_items (bill_id, medicine_id, quantity, unit_price, total)
      VALUES (?, ?, ?, ?, ?)
    `)
    const insertTxn = sqlite.prepare(`
      INSERT INTO stock_transactions (
        medicine_id, transaction_type, quantity,
        reason, reference_id, reference_type,
        performed_by, created_at
      ) VALUES (?, 'out', ?, ?, ?, ?, ?, ?)
    `)
    const updateStock = sqlite.prepare(`
      UPDATE stock
      SET current_quantity = current_quantity - ?, updated_at = ?
      WHERE medicine_id = ?
    `)

    for (const it of items) {
      const total = it.quantity * it.unitPrice
      insertItem.run(billId, it.medicineId, it.quantity, it.unitPrice, total)
      insertTxn.run(
        it.medicineId,
        it.quantity,
        `Bill ${billNumber}`,
        billId,
        'bill',
        createdBy,
        now
      )
      updateStock.run(it.quantity, now, it.medicineId)
    }

    const bill: BillRow = {
      id: billId,
      bill_number: billNumber,
      customer_name: customerName,
      customer_phone: customerPhone,
      subtotal,
      discount_percent: discountPercent,
      tax_percent: taxPercent,
      total_amount: totalAmount,
      payment_mode: paymentMode,
      amount_received: amountReceived,
      change_due: changeDue,
      is_voided: false,
      voided_reason: null,
      voided_by: null,
      created_by: createdBy,
      created_at: now
    }

    const detailItems: BillItemRow[] = items.map((it, idx) => {
      const info = byId.get(it.medicineId)
      return {
        id: idx + 1,
        bill_id: billId,
        medicine_id: it.medicineId,
        medicine_name: info?.name ?? null,
        batch_no: info?.batch_no ?? null,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        total: it.quantity * it.unitPrice
      }
    })

    return { bill, items: detailItems }
  })

  return tx()
}

/**
 * Get paginated bills for history with filters.
 */
export function getBills(filters: GetBillsFilters): { data: BillListRow[]; total: number } {
  const db = getDb()
  const {
    startDate = null,
    endDate = null,
    customerSearch = null,
    paymentMode = null,
    includeVoided = false,
    page = 1,
    pageSize = 20
  } = filters ?? {}

  const conditions: unknown[] = []
  if (!includeVoided) conditions.push(eq(bills.is_voided, false))
  if (paymentMode) conditions.push(eq(bills.payment_mode, paymentMode))
  if (customerSearch?.trim()) {
    const term = `%${customerSearch.trim()}%`
    conditions.push(or(like(bills.customer_name, term), like(bills.customer_phone, term))!)
  }
  if (startDate && endDate) {
    // created_at is ISO string; compare by date prefix (YYYY-MM-DD)
    conditions.push(sql`substr(${bills.created_at}, 1, 10) BETWEEN ${startDate} AND ${endDate}`)
  } else if (startDate) {
    conditions.push(sql`substr(${bills.created_at}, 1, 10) >= ${startDate}`)
  } else if (endDate) {
    conditions.push(sql`substr(${bills.created_at}, 1, 10) <= ${endDate}`)
  }

  const whereClause =
    conditions.length === 0 ? undefined : conditions.length === 1 ? (conditions[0] as never) : (and(...(conditions as never[])) as never)

  const all = db
    .select({
      id: bills.id,
      bill_number: bills.bill_number,
      created_at: bills.created_at,
      customer_name: bills.customer_name,
      customer_phone: bills.customer_phone,
      subtotal: bills.subtotal,
      total_amount: bills.total_amount,
      payment_mode: bills.payment_mode,
      is_voided: bills.is_voided
    })
    .from(bills)
    .where(whereClause)
    .orderBy(desc(bills.created_at))
    .all() as Array<{
    id: number
    bill_number: string
    created_at: string
    customer_name: string | null
    customer_phone: string | null
    subtotal: number
    total_amount: number
    payment_mode: PaymentMode
    is_voided: boolean | number
  }>

  const total = all.length
  const offset = (Math.max(1, page) - 1) * Math.max(1, pageSize)
  const slice = all.slice(offset, offset + pageSize)

  // count items per bill for visible slice
  const ids = slice.map((r) => r.id)
  const counts = new Map<number, number>()
  if (ids.length > 0) {
    const sqlite = getSqlite()
    const placeholders = ids.map(() => '?').join(',')
    const rows = sqlite
      .prepare(
        `SELECT bill_id, COUNT(*) AS cnt
         FROM bill_items
         WHERE bill_id IN (${placeholders})
         GROUP BY bill_id`
      )
      .all(...ids) as Array<{ bill_id: number; cnt: number }>
    for (const r of rows) counts.set(toInt(r.bill_id), toInt(r.cnt))
  }

  const data: BillListRow[] = slice.map((r) => ({
    id: r.id,
    bill_number: r.bill_number,
    created_at: r.created_at,
    customer_name: r.customer_name ?? null,
    customer_phone: r.customer_phone ?? null,
    items_count: counts.get(r.id) ?? 0,
    subtotal: r.subtotal ?? 0,
    total_amount: r.total_amount ?? 0,
    payment_mode: normalizePaymentMode(String(r.payment_mode ?? 'cash')),
    is_voided: !!r.is_voided
  }))

  return { data, total }
}

/**
 * Get a bill with all items and medicine names.
 */
export function getBillById(billId: number): BillDetailResult | null {
  const db = getDb()
  const id = toInt(billId)
  if (!id) return null

  const billRow = db
    .select({
      id: bills.id,
      bill_number: bills.bill_number,
      customer_name: bills.customer_name,
      customer_phone: bills.customer_phone,
      subtotal: bills.subtotal,
      discount_percent: bills.discount_percent,
      tax_percent: bills.tax_percent,
      total_amount: bills.total_amount,
      payment_mode: bills.payment_mode,
      amount_received: bills.amount_received,
      change_due: bills.change_due,
      is_voided: bills.is_voided,
      voided_reason: bills.voided_reason,
      voided_by: bills.voided_by,
      created_by: bills.created_by,
      created_at: bills.created_at
    })
    .from(bills)
    .where(eq(bills.id, id))
    .limit(1)
    .all()[0] as unknown as BillRow | undefined

  if (!billRow) return null

  const items = db
    .select({
      id: billItems.id,
      bill_id: billItems.bill_id,
      medicine_id: billItems.medicine_id,
      quantity: billItems.quantity,
      unit_price: billItems.unit_price,
      total: billItems.total,
      medicine_name: medicines.name,
      batch_no: medicines.batch_no
    })
    .from(billItems)
    .leftJoin(medicines, eq(billItems.medicine_id, medicines.id))
    .where(eq(billItems.bill_id, id))
    .all() as BillItemRow[]

  const bill: BillRow = {
    ...billRow,
    payment_mode: normalizePaymentMode(String((billRow as unknown as { payment_mode?: string }).payment_mode ?? 'cash')),
    is_voided: !!(billRow as unknown as { is_voided?: boolean | number }).is_voided
  }

  return { bill, items }
}

/**
 * Void a bill and restore stock atomically (creates reverse stock transactions).
 */
export function voidBill(input: VoidBillInput): void {
  const sqlite = getSqlite()
  const now = dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS')
  const billId = toInt(input.billId)
  if (!billId) throw new Error('Invalid bill.')
  const reason = String(input.reason ?? '').trim()
  if (!reason) throw new Error('Void reason is required.')
  const voidedBy = toInt(input.voidedBy)
  if (!voidedBy) throw new Error('Voided by user is required.')

  const tx = sqlite.transaction(() => {
    const bill = sqlite
      .prepare(`SELECT id, bill_number, is_voided FROM bills WHERE id = ? LIMIT 1`)
      .get(billId) as { id: number; bill_number: string; is_voided: number } | undefined
    if (!bill) throw new Error('Bill not found.')
    if (bill.is_voided) throw new Error('Bill is already voided.')

    const items = sqlite
      .prepare(`SELECT medicine_id, quantity FROM bill_items WHERE bill_id = ?`)
      .all(billId) as Array<{ medicine_id: number; quantity: number }>
    if (items.length === 0) throw new Error('Bill items not found.')

    sqlite
      .prepare(
        `
        UPDATE bills
        SET is_voided = 1, voided_reason = ?, voided_by = ?
        WHERE id = ?
        `
      )
      .run(reason, voidedBy, billId)

    const insertTxn = sqlite.prepare(`
      INSERT INTO stock_transactions (
        medicine_id, transaction_type, quantity,
        reason, reference_id, reference_type,
        performed_by, created_at
      ) VALUES (?, 'in', ?, ?, ?, ?, ?, ?)
    `)
    const updateStock = sqlite.prepare(`
      UPDATE stock
      SET current_quantity = current_quantity + ?, updated_at = ?
      WHERE medicine_id = ?
    `)

    for (const it of items) {
      insertTxn.run(
        it.medicine_id,
        it.quantity,
        `Void ${bill.bill_number}: ${reason}`,
        billId,
        'bill_void',
        voidedBy,
        now
      )
      updateStock.run(it.quantity, now, it.medicine_id)
    }
  })

  tx()
}

/**
 * Get daily sales summary (excludes voided bills).
 */
export function getDailySummary(date: string): DailySummary {
  const sqlite = getSqlite()
  const d = String(date ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.')
  }

  const row = sqlite
    .prepare(
      `
      SELECT 
        COALESCE(SUM(total_amount), 0) AS totalSales,
        COUNT(*) AS billCount
      FROM bills
      WHERE is_voided = 0 AND substr(created_at, 1, 10) = ?
      `
    )
    .get(d) as { totalSales: number; billCount: number } | undefined

  return {
    date: d,
    totalSales: toInt(row?.totalSales ?? 0),
    billCount: toInt(row?.billCount ?? 0)
  }
}

