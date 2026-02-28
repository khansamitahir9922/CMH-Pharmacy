import { eq, desc } from 'drizzle-orm'
import { getDb } from '../init'
import { suppliers, purchaseOrders, purchaseOrderItems, medicines, stock, stockTransactions } from '../schema'
import dayjs from 'dayjs'

export interface SupplierRow {
  id: number
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  ntn_cnic: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface SupplierWithStats extends SupplierRow {
  total_orders: number
  outstanding_balance: number
}

export interface CreateSupplierInput {
  name: string
  contact_person: string
  phone: string
  email: string | null
  address: string | null
  ntn_cnic: string | null
  notes: string | null
  is_active: boolean
}

export interface UpdateSupplierInput extends Partial<CreateSupplierInput> {
  id: number
}

/**
 * Get all suppliers with optional search. Excludes soft-deleted (is_active = false).
 * Includes total_orders and outstanding_balance (sum of total_amount - paid_amount for their orders).
 */
export function getAll(search?: string): SupplierWithStats[] {
  const db = getDb()
  const allRows = db.select().from(suppliers).orderBy(suppliers.name).all() as SupplierRow[]
  const list = allRows.filter((s) => s.is_active === true || s.is_active === 1)

  if (search?.trim()) {
    const term = search.trim().toLowerCase()
    const filtered = list.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.phone ?? '').toLowerCase().includes(term) ||
        (s.contact_person ?? '').toLowerCase().includes(term)
    )
    return filtered.map((s) => attachSupplierStats(db, s))
  }
  return list.map((s) => attachSupplierStats(db, s))
}

function attachSupplierStats(db: ReturnType<typeof getDb>, supplier: SupplierRow): SupplierWithStats {
  const orders = db
    .select({
      total_amount: purchaseOrders.total_amount,
      paid_amount: purchaseOrders.paid_amount
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.supplier_id, supplier.id))
    .all()
  let outstanding_balance = 0
  for (const o of orders) {
    outstanding_balance += (o.total_amount ?? 0) - (o.paid_amount ?? 0)
  }
  return {
    ...supplier,
    is_active: !!supplier.is_active,
    total_orders: orders.length,
    outstanding_balance
  }
}

/**
 * Get supplier by ID with orders and outstanding balance.
 */
export function getById(id: number): SupplierWithStats | null {
  const db = getDb()
  const row = db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1).all()[0] as SupplierRow | undefined
  if (!row) return null
  return attachSupplierStats(db, row)
}

/**
 * Create a new supplier.
 */
export function create(input: CreateSupplierInput): { id: number } {
  const db = getDb()
  const active = input.is_active !== false
  const result = db
    .insert(suppliers)
    .values({
      name: input.name.trim(),
      contact_person: input.contact_person?.trim() ?? null,
      phone: input.phone?.trim() ?? null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      ntn_cnic: input.ntn_cnic?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: active
    })
    .returning({ id: suppliers.id })
    .all()
  const r = result[0]
  if (!r) throw new Error('Failed to create supplier')
  return { id: r.id }
}

/**
 * Update supplier by ID.
 */
export function update(input: UpdateSupplierInput): void {
  const db = getDb()
  const { id, ...rest } = input
  const updates: Record<string, unknown> = { ...rest }
  if (rest.is_active !== undefined) updates.is_active = rest.is_active
  db.update(suppliers).set(updates as Record<string, string | number | null | boolean>).where(eq(suppliers.id, id)).run()
}

/**
 * Soft-delete supplier (set is_active = false).
 */
export function remove(id: number): void {
  const db = getDb()
  db.update(suppliers).set({ is_active: false }).where(eq(suppliers.id, id)).run()
}

/* ─────────────────────── PURCHASE ORDERS ─────────────────────── */

export type OrderStatus = 'pending' | 'partial' | 'received' | 'cancelled'

export interface PurchaseOrderRow {
  id: number
  order_number: string
  supplier_id: number | null
  order_date: string
  expected_date: string | null
  received_date: string | null
  status: OrderStatus
  total_amount: number
  paid_amount: number
  notes: string | null
  created_by: number | null
  created_at: string
}

export interface PurchaseOrderWithSupplier extends PurchaseOrderRow {
  supplier_name: string | null
  items_count: number
}

export interface PurchaseOrderItemRow {
  id: number
  purchase_order_id: number
  medicine_id: number
  quantity_ordered: number
  quantity_received: number
  unit_price: number
  medicine_name: string | null
}

export interface GetPurchaseOrdersFilters {
  supplierId?: number | null
  status?: OrderStatus | null
  startDate?: string | null
  endDate?: string | null
  page?: number
  pageSize?: number
}

function generateOrderNumber(db: ReturnType<typeof getDb>): string {
  const last = db
    .select({ order_number: purchaseOrders.order_number })
    .from(purchaseOrders)
    .orderBy(desc(purchaseOrders.id))
    .limit(1)
    .all()[0]
  if (!last?.order_number) return 'PO-00001'
  const match = last.order_number.match(/PO-(\d+)/)
  const num = match ? parseInt(match[1], 10) + 1 : 1
  return `PO-${String(num).padStart(5, '0')}`
}

/**
 * Get purchase orders with optional filters and pagination.
 */
export function getPurchaseOrders(filters: GetPurchaseOrdersFilters): { data: PurchaseOrderWithSupplier[]; total: number } {
  const db = getDb()
  const { supplierId = null, status = null, startDate = null, endDate = null, page = 1, pageSize = 20 } = filters
  let rows = db
    .select({
      id: purchaseOrders.id,
      order_number: purchaseOrders.order_number,
      supplier_id: purchaseOrders.supplier_id,
      order_date: purchaseOrders.order_date,
      expected_date: purchaseOrders.expected_date,
      received_date: purchaseOrders.received_date,
      status: purchaseOrders.status,
      total_amount: purchaseOrders.total_amount,
      paid_amount: purchaseOrders.paid_amount,
      notes: purchaseOrders.notes,
      created_by: purchaseOrders.created_by,
      created_at: purchaseOrders.created_at,
      supplier_name: suppliers.name
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplier_id, suppliers.id))
    .orderBy(desc(purchaseOrders.id))
    .all() as (PurchaseOrderRow & { supplier_name: string | null })[]

  if (supplierId != null && supplierId > 0) {
    rows = rows.filter((r) => r.supplier_id === supplierId)
  }
  if (status) {
    rows = rows.filter((r) => r.status === status)
  }
  if (startDate || endDate) {
    rows = rows.filter((r) => {
      const d = r.order_date?.slice(0, 10)
      if (startDate && d < startDate) return false
      if (endDate && d > endDate) return false
      return true
    })
  }
  const total = rows.length
  const offset = (page - 1) * pageSize
  const sliced = rows.slice(offset, offset + pageSize)
  const countMap = new Map<number, number>()
  for (const r of sliced) {
    const count = db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchase_order_id, r.id))
      .all().length
    countMap.set(r.id, count)
  }
  const data: PurchaseOrderWithSupplier[] = sliced.map((r) => ({
    ...r,
    supplier_name: r.supplier_name ?? null,
    items_count: countMap.get(r.id) ?? 0
  }))
  return { data, total }
}

/**
 * Get a single purchase order by ID with supplier and line items.
 */
export function getPurchaseOrderById(orderId: number): {
  order: PurchaseOrderRow & { supplier_name: string | null }
  items: PurchaseOrderItemRow[]
} | null {
  const db = getDb()
  const orderRow = db
    .select({
      id: purchaseOrders.id,
      order_number: purchaseOrders.order_number,
      supplier_id: purchaseOrders.supplier_id,
      order_date: purchaseOrders.order_date,
      expected_date: purchaseOrders.expected_date,
      received_date: purchaseOrders.received_date,
      status: purchaseOrders.status,
      total_amount: purchaseOrders.total_amount,
      paid_amount: purchaseOrders.paid_amount,
      notes: purchaseOrders.notes,
      created_by: purchaseOrders.created_by,
      created_at: purchaseOrders.created_at,
      supplier_name: suppliers.name
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplier_id, suppliers.id))
    .where(eq(purchaseOrders.id, orderId))
    .limit(1)
    .all()[0]
  if (!orderRow) return null
  const items = db
    .select({
      id: purchaseOrderItems.id,
      purchase_order_id: purchaseOrderItems.purchase_order_id,
      medicine_id: purchaseOrderItems.medicine_id,
      quantity_ordered: purchaseOrderItems.quantity_ordered,
      quantity_received: purchaseOrderItems.quantity_received,
      unit_price: purchaseOrderItems.unit_price,
      medicine_name: medicines.name
    })
    .from(purchaseOrderItems)
    .leftJoin(medicines, eq(purchaseOrderItems.medicine_id, medicines.id))
    .where(eq(purchaseOrderItems.purchase_order_id, orderId))
    .all() as PurchaseOrderItemRow[]
  return {
    order: orderRow as PurchaseOrderRow & { supplier_name: string | null },
    items: items.map((i) => ({ ...i, medicine_name: i.medicine_name ?? null }))
  }
}

export interface CreatePurchaseOrderInput {
  supplier_id: number
  order_date: string
  expected_date: string | null
  notes: string | null
  created_by: number | null
  items: { medicine_id: number; quantity_ordered: number; unit_price: number }[]
}

/**
 * Create purchase order and items. total_amount computed from items (prices in paisa).
 */
export function createPurchaseOrder(input: CreatePurchaseOrderInput): { id: number; order_number: string } {
  const db = getDb()
  if (!input.items?.length) throw new Error('Order must have at least one item.')
  const orderNumber = generateOrderNumber(db)
  let totalAmount = 0
  for (const item of input.items) {
    totalAmount += item.quantity_ordered * item.unit_price
  }
  const result = db
    .insert(purchaseOrders)
    .values({
      order_number: orderNumber,
      supplier_id: input.supplier_id,
      order_date: input.order_date,
      expected_date: input.expected_date,
      status: 'pending',
      total_amount: totalAmount,
      paid_amount: 0,
      notes: input.notes,
      created_by: input.created_by
    })
    .returning({ id: purchaseOrders.id, order_number: purchaseOrders.order_number })
    .all()
  const row = result[0]
  if (!row) throw new Error('Failed to create purchase order')
  const orderId = row.id
  for (const item of input.items) {
    db.insert(purchaseOrderItems).values({
      purchase_order_id: orderId,
      medicine_id: item.medicine_id,
      quantity_ordered: item.quantity_ordered,
      quantity_received: 0,
      unit_price: item.unit_price
    }).run()
  }
  return { id: orderId, order_number: row.order_number }
}

/**
 * Update order status (e.g. cancelled).
 */
export function updateOrderStatus(orderId: number, status: OrderStatus, receivedDate?: string | null): void {
  const db = getDb()
  const updates: Record<string, unknown> = { status }
  if (receivedDate !== undefined) updates.received_date = receivedDate
  db.update(purchaseOrders).set(updates as Record<string, string | number>).where(eq(purchaseOrders.id, orderId)).run()
}

/**
 * Record payment: update paid_amount and recalculate status (partial/received).
 */
export function recordPayment(orderId: number, amountPaid: number): void {
  const db = getDb()
  const row = db.select().from(purchaseOrders).where(eq(purchaseOrders.id, orderId)).limit(1).all()[0]
  if (!row) throw new Error('Order not found.')
  const total = row.total_amount ?? 0
  const currentPaid = row.paid_amount ?? 0
  const newPaid = currentPaid + amountPaid
  if (newPaid > total) throw new Error('Payment cannot exceed order total.')
  const status: OrderStatus = newPaid >= total ? 'received' : 'partial'
  db.update(purchaseOrders).set({ paid_amount: newPaid, status }).where(eq(purchaseOrders.id, orderId)).run()
}

/**
 * Mark order as received: set status, received_date, and create stock_transactions (type 'in') for each item.
 * Also updates stock table and quantity_received on items.
 */
export function markOrderReceived(orderId: number): void {
  const db = getDb()
  const order = db.select().from(purchaseOrders).where(eq(purchaseOrders.id, orderId)).limit(1).all()[0]
  if (!order) throw new Error('Order not found.')
  if (order.status === 'cancelled') throw new Error('Cannot receive a cancelled order.')
  const now = dayjs().toISOString()
  const receivedDate = now.slice(0, 10)
  const items = db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchase_order_id, orderId)).all()
  for (const item of items) {
    const qty = item.quantity_ordered ?? 0
    if (qty <= 0) continue
    const stockRow = db.select().from(stock).where(eq(stock.medicine_id, item.medicine_id)).limit(1).all()[0]
    if (stockRow) {
      const newQty = (stockRow.current_quantity ?? 0) + qty
      db.update(stock).set({ current_quantity: newQty, updated_at: now }).where(eq(stock.medicine_id, item.medicine_id)).run()
    } else {
      db.insert(stock).values({ medicine_id: item.medicine_id, current_quantity: qty, updated_at: now }).run()
    }
    db.insert(stockTransactions).values({
      medicine_id: item.medicine_id,
      transaction_type: 'in',
      quantity: qty,
      reason: `Purchase Order ${order.order_number}`,
      reference_id: orderId,
      reference_type: 'purchase_order'
    }).run()
    db.update(purchaseOrderItems)
      .set({ quantity_received: qty })
      .where(eq(purchaseOrderItems.id, item.id))
      .run()
  }
  const newStatus: OrderStatus = (order.paid_amount ?? 0) >= (order.total_amount ?? 0) ? 'received' : 'partial'
  db.update(purchaseOrders)
    .set({ status: newStatus, received_date: receivedDate })
    .where(eq(purchaseOrders.id, orderId))
    .run()
}
