import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { getDb, getSqlite } from '../init'
import { bills, billItems, medicines, medicineCategories, stock, stockTransactions, purchaseOrders, purchaseOrderItems, suppliers, users } from '../schema'

export interface SalesReportRow {
  date: string
  bill_id: number
  bill_number: string
  customer_name: string | null
  items_count: number
  total_amount: number
  payment_mode: string
}

export interface SalesReportSummary {
  totalBills: number
  totalRevenue: number
  avgBillValue: number
  topMedicineName: string | null
}

export interface StockBalanceRow {
  medicine_id: number
  medicine_name: string
  medicine_generic_name?: string | null
  category_name: string | null
  batch_no: string | null
  expiry_date: string | null
  opening: number
  issued: number
  received: number
  closing: number
}

export interface StockBalanceSummary {
  totalSkus: number
  totalUnits: number
  totalStockValue: number
}

export interface PurchaseReportRow {
  id: number
  order_number: string
  supplier_name: string | null
  order_date: string
  items_count: number
  total_amount: number
  paid_amount: number
  balance: number
  status: string
}

export interface MedicineIssueRow {
  date: string
  medicine_name: string | null
  medicine_generic_name?: string | null
  quantity: number
  type: string
  reason: string | null
  reference: string | null
}

/**
 * Sales report: bills in date range with summary and top medicine.
 */
export function getSalesReport(startDate: string, endDate: string): { summary: SalesReportSummary; rows: SalesReportRow[] } {
  const db = getDb()
  const start = String(startDate).slice(0, 10)
  const end = String(endDate).slice(0, 10)

  const billRows = db
    .select({
      id: bills.id,
      bill_number: bills.bill_number,
      created_at: bills.created_at,
      customer_name: bills.customer_name,
      total_amount: bills.total_amount,
      payment_mode: bills.payment_mode
    })
    .from(bills)
    .where(and(eq(bills.is_voided, false), sql`substr(${bills.created_at}, 1, 10) BETWEEN ${start} AND ${end}`))
    .orderBy(bills.created_at)
    .all() as Array<{
    id: number
    bill_number: string
    created_at: string
    customer_name: string | null
    total_amount: number
    payment_mode: string
  }>

  const ids = billRows.map((r) => r.id)
  const counts = new Map<number, number>()
  const medicineCount = new Map<number, number>()

  if (ids.length > 0) {
    const items = db
      .select({ bill_id: billItems.bill_id, medicine_id: billItems.medicine_id, quantity: billItems.quantity })
      .from(billItems)
      .where(inArray(billItems.bill_id, ids))
      .all()
    for (const it of items) {
      counts.set(it.bill_id, (counts.get(it.bill_id) ?? 0) + 1)
      medicineCount.set(it.medicine_id, (medicineCount.get(it.medicine_id) ?? 0) + it.quantity)
    }
  }

  let topMedicineName: string | null = null
  if (medicineCount.size > 0) {
    const sorted = [...medicineCount.entries()].sort((a, b) => b[1] - a[1])
    const topId = sorted[0][0]
    const m = db.select({ name: medicines.name }).from(medicines).where(eq(medicines.id, topId)).limit(1).all()[0]
    topMedicineName = (m as { name?: string })?.name ?? null
  }

  const totalRevenue = billRows.reduce((s, r) => s + (r.total_amount ?? 0), 0)
  const summary: SalesReportSummary = {
    totalBills: billRows.length,
    totalRevenue,
    avgBillValue: billRows.length > 0 ? Math.round(totalRevenue / billRows.length) : 0,
    topMedicineName
  }

  const rows: SalesReportRow[] = billRows.map((r) => ({
    date: (r.created_at ?? '').slice(0, 10),
    bill_id: r.id,
    bill_number: r.bill_number,
    customer_name: r.customer_name ?? null,
    items_count: counts.get(r.id) ?? 0,
    total_amount: r.total_amount ?? 0,
    payment_mode: (r.payment_mode ?? 'cash').toUpperCase()
  }))

  return { summary, rows }
}

/**
 * Stock balance as of date. Issued/Received from transactions; Opening = Closing - Received + Issued.
 */
export function getStockBalance(asOfDate: string, categoryId?: number | null): { summary: StockBalanceSummary; rows: StockBalanceRow[] } {
  const db = getDb()
  const d = String(asOfDate).slice(0, 10)

  const meds = db
    .select({
      id: medicines.id,
      name: medicines.name,
      generic_name: medicines.generic_name,
      batch_no: medicines.batch_no,
      expiry_date: medicines.expiry_date,
      unit_price_sell: medicines.unit_price_sell,
      category_id: medicines.category_id,
      category_name: medicineCategories.name,
      current_quantity: stock.current_quantity
    })
    .from(medicines)
    .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
    .leftJoin(stock, eq(medicines.id, stock.medicine_id))
    .where(eq(medicines.is_deleted, false))
    .all() as Array<{
    id: number
    name: string
    generic_name: string | null
    batch_no: string | null
    expiry_date: string | null
    unit_price_sell: number
    category_id: number | null
    category_name: string | null
    current_quantity: number | null
  }>

  let filtered = meds
  if (categoryId != null && categoryId > 0) {
    filtered = meds.filter((m) => m.category_id === categoryId)
  }

  const rows: StockBalanceRow[] = []
  let totalUnits = 0
  let totalStockValue = 0

  for (const m of filtered) {
    const closing = m.current_quantity ?? 0
    const txRows = db
      .select({ transaction_type: stockTransactions.transaction_type, quantity: stockTransactions.quantity })
      .from(stockTransactions)
      .where(and(eq(stockTransactions.medicine_id, m.id), sql`substr(${stockTransactions.created_at}, 1, 10) <= ${d}`))
      .all() as Array<{ transaction_type: string; quantity: number }>
    let received = 0
    let issued = 0
    for (const t of txRows) {
      if (t.transaction_type === 'in') received += t.quantity
      else if (t.transaction_type === 'out') issued += t.quantity
    }
    const opening = Math.max(0, closing - received + issued)
    rows.push({
      medicine_id: m.id,
      medicine_name: m.name,
      medicine_generic_name: m.generic_name ?? null,
      category_name: m.category_name ?? null,
      batch_no: m.batch_no ?? null,
      expiry_date: m.expiry_date ?? null,
      opening,
      issued,
      received,
      closing
    })
    totalUnits += closing
    totalStockValue += closing * (m.unit_price_sell ?? 0)
  }

  const summary: StockBalanceSummary = {
    totalSkus: rows.length,
    totalUnits,
    totalStockValue
  }

  return { summary, rows }
}

/**
 * Purchase orders in date range with optional supplier filter.
 */
export function getPurchasesReport(
  startDate: string,
  endDate: string,
  supplierId?: number | null
): { rows: PurchaseReportRow[]; totalOutstanding: number } {
  const db = getDb()
  const start = String(startDate).slice(0, 10)
  const end = String(endDate).slice(0, 10)

  const conditions: unknown[] = [sql`substr(${purchaseOrders.order_date}, 1, 10) BETWEEN ${start} AND ${end}`]
  if (supplierId != null && supplierId > 0) {
    conditions.push(eq(purchaseOrders.supplier_id, supplierId))
  }
  const whereClause = conditions.length === 1 ? conditions[0] : and(...(conditions as never[]))

  const orders = db
    .select({
      id: purchaseOrders.id,
      order_number: purchaseOrders.order_number,
      supply_order_number: purchaseOrders.supply_order_number,
      order_date: purchaseOrders.order_date,
      total_amount: purchaseOrders.total_amount,
      paid_amount: purchaseOrders.paid_amount,
      status: purchaseOrders.status,
      supplier_name: suppliers.name
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplier_id, suppliers.id))
    .where(whereClause)
    .orderBy(desc(purchaseOrders.order_date))
    .all() as Array<{
    id: number
    order_number: string
    supply_order_number: string
    order_date: string
    total_amount: number
    paid_amount: number
    status: string
    supplier_name: string | null
  }>

  const sqlite = getSqlite()
  const counts = new Map<number, number>()
  for (const o of orders) {
    const r = sqlite.prepare('SELECT COUNT(*) as cnt FROM purchase_order_items WHERE purchase_order_id = ?').get(o.id) as { cnt: number }
    counts.set(o.id, r?.cnt ?? 0)
  }

  let totalOutstanding = 0
  const rows: PurchaseReportRow[] = orders.map((o) => {
    const balance = (o.total_amount ?? 0) - (o.paid_amount ?? 0)
    if (o.status !== 'cancelled' && o.status !== 'received') totalOutstanding += balance
    return {
      id: o.id,
      order_number: o.supply_order_number ?? o.order_number,
      supply_order_number: o.supply_order_number ?? o.order_number,
      supplier_name: o.supplier_name ?? null,
      order_date: o.order_date,
      items_count: counts.get(o.id) ?? 0,
      total_amount: o.total_amount ?? 0,
      paid_amount: o.paid_amount ?? 0,
      balance,
      status: (o.status ?? 'pending').charAt(0).toUpperCase() + (o.status ?? '').slice(1)
    }
  })

  return { rows, totalOutstanding }
}

/**
 * Medicine issues (stock out transactions) in date range with optional medicine filter.
 */
export function getMedicineIssues(
  startDate: string,
  endDate: string,
  medicineId?: number | null
): MedicineIssueRow[] {
  const db = getDb()
  const start = String(startDate).slice(0, 10)
  const end = String(endDate).slice(0, 10)

  const conditions: unknown[] = [
    eq(stockTransactions.transaction_type, 'out'),
    sql`substr(${stockTransactions.created_at}, 1, 10) BETWEEN ${start} AND ${end}`
  ]
  if (medicineId != null && medicineId > 0) {
    conditions.push(eq(stockTransactions.medicine_id, medicineId))
  }
  const whereClause = and(...(conditions as never[]))

  const rows = db
    .select({
      created_at: stockTransactions.created_at,
      medicine_id: stockTransactions.medicine_id,
      quantity: stockTransactions.quantity,
      reason: stockTransactions.reason,
      reference_id: stockTransactions.reference_id,
      reference_type: stockTransactions.reference_type,
      medicine_name: medicines.name,
      medicine_generic_name: medicines.generic_name
    })
    .from(stockTransactions)
    .leftJoin(medicines, eq(stockTransactions.medicine_id, medicines.id))
    .where(whereClause)
    .orderBy(desc(stockTransactions.created_at))
    .all() as Array<{
    created_at: string
    medicine_id: number
    quantity: number
    reason: string | null
    reference_id: number | null
    reference_type: string | null
    medicine_name: string | null
    medicine_generic_name: string | null
  }>

  return rows.map((r) => ({
    date: (r.created_at ?? '').slice(0, 10),
    medicine_name: r.medicine_name ?? null,
    medicine_generic_name: r.medicine_generic_name ?? null,
    quantity: r.quantity,
    type: r.reference_type === 'bill' ? 'Sale' : 'Manual',
    reason: r.reason ?? null,
    reference: r.reference_id != null ? `${r.reference_type ?? ''}-${r.reference_id}` : null
  }))
}

/* ─────────────────────── ADJUSTMENT LOG REPORT ────────────────────── */

export interface AdjustmentLogRow {
  id: number
  created_at: string
  medicine_name: string | null
  medicine_generic_name?: string | null
  batch_no: string | null
  transaction_type: string
  quantity: number
  reason: string | null
  performer_name: string | null
}

export function getAdjustmentLog(
  startDate: string,
  endDate: string,
  userId?: number | null
): AdjustmentLogRow[] {
  const db = getDb()
  const start = String(startDate).slice(0, 10)
  const end = String(endDate).slice(0, 10)
  const conditions: unknown[] = [
    sql`substr(${stockTransactions.created_at}, 1, 10) BETWEEN ${start} AND ${end}`
  ]
  conditions.push(eq(stockTransactions.transaction_type, 'adjust'))
  if (userId != null && userId > 0) {
    conditions.push(eq(stockTransactions.performed_by, userId))
  }
  const whereClause = and(...(conditions as never[]))
  const rows = db
    .select({
      id: stockTransactions.id,
      created_at: stockTransactions.created_at,
      medicine_name: medicines.name,
      medicine_generic_name: medicines.generic_name,
      batch_no: medicines.batch_no,
      transaction_type: stockTransactions.transaction_type,
      quantity: stockTransactions.quantity,
      reason: stockTransactions.reason,
      performer_name: users.full_name
    })
    .from(stockTransactions)
    .leftJoin(medicines, eq(stockTransactions.medicine_id, medicines.id))
    .leftJoin(users, eq(stockTransactions.performed_by, users.id))
    .where(whereClause)
    .orderBy(desc(stockTransactions.created_at))
    .all() as Array<{
    id: number
    created_at: string
    medicine_name: string | null
    medicine_generic_name: string | null
    batch_no: string | null
    transaction_type: string
    quantity: number
    reason: string | null
    performer_name: string | null
  }>
  return rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    medicine_name: r.medicine_name ?? null,
    medicine_generic_name: r.medicine_generic_name ?? null,
    batch_no: r.batch_no ?? null,
    transaction_type: r.transaction_type,
    quantity: r.quantity,
    reason: r.reason ?? null,
    performer_name: r.performer_name ?? null
  }))
}

/* ─────────────────────── STOCK VARIANCE REPORT ────────────────────── */

export interface StockVarianceRow {
  medicine_id: number
  medicine_name: string | null
  medicine_generic_name?: string | null
  category_name: string | null
  received: number
  issued: number
  variance: number
}

export function getStockVarianceReport(startDate: string, endDate: string): StockVarianceRow[] {
  const db = getDb()
  const start = String(startDate).slice(0, 10)
  const end = String(endDate).slice(0, 10)
  const inRows = db
    .select({
      medicine_id: stockTransactions.medicine_id,
      quantity: stockTransactions.quantity
    })
    .from(stockTransactions)
    .where(
      and(
        eq(stockTransactions.transaction_type, 'in'),
        sql`substr(${stockTransactions.created_at}, 1, 10) BETWEEN ${start} AND ${end}`
      )
    )
    .all()
  const outRows = db
    .select({
      medicine_id: stockTransactions.medicine_id,
      quantity: stockTransactions.quantity
    })
    .from(stockTransactions)
    .where(
      and(
        eq(stockTransactions.transaction_type, 'out'),
        sql`substr(${stockTransactions.created_at}, 1, 10) BETWEEN ${start} AND ${end}`
      )
    )
    .all()
  const inByMed = new Map<number, number>()
  const outByMed = new Map<number, number>()
  for (const r of inRows) {
    inByMed.set(r.medicine_id, (inByMed.get(r.medicine_id) ?? 0) + (r.quantity ?? 0))
  }
  for (const r of outRows) {
    outByMed.set(r.medicine_id, (outByMed.get(r.medicine_id) ?? 0) + (r.quantity ?? 0))
  }
  const allMedIds = new Set([...inByMed.keys(), ...outByMed.keys()])
  const medList = db
    .select({
      id: medicines.id,
      name: medicines.name,
      generic_name: medicines.generic_name,
      category_name: medicineCategories.name
    })
    .from(medicines)
    .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
    .where(eq(medicines.is_deleted, false))
    .all() as Array<{ id: number; name: string; generic_name: string | null; category_name: string | null }>
  const result: StockVarianceRow[] = []
  for (const m of medList) {
    const received = inByMed.get(m.id) ?? 0
    const issued = outByMed.get(m.id) ?? 0
    if (received === 0 && issued === 0 && !allMedIds.has(m.id)) continue
    result.push({
      medicine_id: m.id,
      medicine_name: m.name,
      medicine_generic_name: m.generic_name ?? null,
      category_name: m.category_name ?? null,
      received,
      issued,
      variance: received - issued
    })
  }
  return result.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
}

/* ───────────────────── PURCHASE VS CONSUMPTION ────────────────────── */

export interface PurchaseVsConsumptionRow {
  medicine_id: number
  medicine_name: string | null
  medicine_generic_name?: string | null
  category_name: string | null
  purchase_qty: number
  consumption_qty: number
  difference: number
}

export function getPurchaseVsConsumptionReport(
  startDate: string,
  endDate: string
): PurchaseVsConsumptionRow[] {
  const db = getDb()
  const start = String(startDate).slice(0, 10)
  const end = String(endDate).slice(0, 10)
  const inFromPO = db
    .select({
      medicine_id: stockTransactions.medicine_id,
      quantity: stockTransactions.quantity
    })
    .from(stockTransactions)
    .where(
      and(
        eq(stockTransactions.transaction_type, 'in'),
        eq(stockTransactions.reference_type, 'purchase_order'),
        sql`substr(${stockTransactions.created_at}, 1, 10) BETWEEN ${start} AND ${end}`
      )
    )
    .all()
  const outRows = db
    .select({
      medicine_id: stockTransactions.medicine_id,
      quantity: stockTransactions.quantity
    })
    .from(stockTransactions)
    .where(
      and(
        eq(stockTransactions.transaction_type, 'out'),
        sql`substr(${stockTransactions.created_at}, 1, 10) BETWEEN ${start} AND ${end}`
      )
    )
    .all()
  const purchaseByMed = new Map<number, number>()
  const consumptionByMed = new Map<number, number>()
  for (const r of inFromPO) {
    purchaseByMed.set(r.medicine_id, (purchaseByMed.get(r.medicine_id) ?? 0) + (r.quantity ?? 0))
  }
  for (const r of outRows) {
    consumptionByMed.set(r.medicine_id, (consumptionByMed.get(r.medicine_id) ?? 0) + (r.quantity ?? 0))
  }
  const allMedIds = new Set([...purchaseByMed.keys(), ...consumptionByMed.keys()])
  const medList = db
    .select({
      id: medicines.id,
      name: medicines.name,
      generic_name: medicines.generic_name,
      category_name: medicineCategories.name
    })
    .from(medicines)
    .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
    .where(eq(medicines.is_deleted, false))
    .all() as Array<{ id: number; name: string; generic_name: string | null; category_name: string | null }>
  const result: PurchaseVsConsumptionRow[] = []
  for (const m of medList) {
    const purchase_qty = purchaseByMed.get(m.id) ?? 0
    const consumption_qty = consumptionByMed.get(m.id) ?? 0
    if (purchase_qty === 0 && consumption_qty === 0 && !allMedIds.has(m.id)) continue
    result.push({
      medicine_id: m.id,
      medicine_name: m.name,
      medicine_generic_name: m.generic_name ?? null,
      category_name: m.category_name ?? null,
      purchase_qty,
      consumption_qty,
      difference: purchase_qty - consumption_qty
    })
  }
  return result.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
}

/* ───────────────────── CONTROLLED DRUG REGISTER ───────────────────── */

export interface ControlledDrugRow {
  id: number
  name: string
  category_name: string | null
  batch_no: string | null
  current_quantity: number
  unit_price_sell: number
}

export function getControlledDrugRegister(): ControlledDrugRow[] {
  const db = getDb()
  const rows = db
    .select({
      id: medicines.id,
      name: medicines.name,
      category_name: medicineCategories.name,
      batch_no: medicines.batch_no,
      current_quantity: stock.current_quantity,
      unit_price_sell: medicines.unit_price_sell
    })
    .from(medicines)
    .leftJoin(medicineCategories, eq(medicines.category_id, medicineCategories.id))
    .leftJoin(stock, eq(medicines.id, stock.medicine_id))
    .where(and(eq(medicines.is_deleted, false), eq(medicines.is_controlled, true)))
    .orderBy(medicines.name)
    .all() as Array<{
    id: number
    name: string
    category_name: string | null
    batch_no: string | null
    current_quantity: number
    unit_price_sell: number
  }>
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category_name: r.category_name ?? null,
    batch_no: r.batch_no ?? null,
    current_quantity: r.current_quantity ?? 0,
    unit_price_sell: r.unit_price_sell ?? 0
  }))
}
