import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/* ────────────────────────────── USERS ────────────────────────────── */

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  full_name: text('full_name').notNull(),
  role: text('role', { enum: ['admin', 'manager', 'pharmacist', 'dataentry'] }).notNull(),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  last_login: text('last_login'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`)
})

/* ────────────────────────── MEDICINE CATEGORIES ──────────────────── */

export const medicineCategories = sqliteTable('medicine_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`)
})

/* ──────────────────────────── MEDICINES ──────────────────────────── */

export const medicines = sqliteTable('medicines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category_id: integer('category_id').references(() => medicineCategories.id),
  batch_no: text('batch_no'),
  mfg_date: text('mfg_date'),
  expiry_date: text('expiry_date'),
  received_date: text('received_date'),
  order_date: text('order_date'),
  firm_name: text('firm_name'),
  opening_stock: integer('opening_stock').notNull().default(0),
  unit_price_buy: integer('unit_price_buy').notNull().default(0),
  unit_price_sell: integer('unit_price_sell').notNull().default(0),
  min_stock_level: integer('min_stock_level').notNull().default(10),
  shelf_location: text('shelf_location'),
  notes: text('notes'),
  is_deleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`)
})

/* ──────────────────────────── STOCK ──────────────────────────────── */

export const stock = sqliteTable('stock', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  medicine_id: integer('medicine_id').notNull().unique().references(() => medicines.id),
  current_quantity: integer('current_quantity').notNull().default(0),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`)
})

/* ────────────────────── STOCK TRANSACTIONS ───────────────────────── */

export const stockTransactions = sqliteTable('stock_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  medicine_id: integer('medicine_id').notNull().references(() => medicines.id),
  transaction_type: text('transaction_type', { enum: ['in', 'out', 'adjust', 'return'] }).notNull(),
  quantity: integer('quantity').notNull(),
  reason: text('reason'),
  reference_id: integer('reference_id'),
  reference_type: text('reference_type'),
  performed_by: integer('performed_by').references(() => users.id),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`)
})

/* ──────────────────────────── SUPPLIERS ──────────────────────────── */

export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  contact_person: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  ntn_cnic: text('ntn_cnic'),
  notes: text('notes'),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`)
})

/* ────────────────────── PURCHASE ORDERS ──────────────────────────── */

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  order_number: text('order_number').notNull().unique(),
  supplier_id: integer('supplier_id').references(() => suppliers.id),
  order_date: text('order_date').notNull(),
  expected_date: text('expected_date'),
  received_date: text('received_date'),
  status: text('status', { enum: ['pending', 'partial', 'received', 'cancelled'] }).notNull().default('pending'),
  total_amount: integer('total_amount').notNull().default(0),
  paid_amount: integer('paid_amount').notNull().default(0),
  notes: text('notes'),
  created_by: integer('created_by').references(() => users.id),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`)
})

/* ────────────────── PURCHASE ORDER ITEMS ─────────────────────────── */

export const purchaseOrderItems = sqliteTable('purchase_order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  purchase_order_id: integer('purchase_order_id').notNull().references(() => purchaseOrders.id),
  medicine_id: integer('medicine_id').notNull().references(() => medicines.id),
  quantity_ordered: integer('quantity_ordered').notNull(),
  quantity_received: integer('quantity_received').notNull().default(0),
  unit_price: integer('unit_price').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`)
})

/* ──────────────────────────── BILLS ──────────────────────────────── */

export const bills = sqliteTable('bills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bill_number: text('bill_number').notNull().unique(),
  customer_name: text('customer_name'),
  customer_phone: text('customer_phone'),
  subtotal: integer('subtotal').notNull().default(0),
  discount_percent: integer('discount_percent').notNull().default(0),
  tax_percent: integer('tax_percent').notNull().default(0),
  total_amount: integer('total_amount').notNull().default(0),
  payment_mode: text('payment_mode', { enum: ['cash', 'card', 'credit'] }).notNull().default('cash'),
  amount_received: integer('amount_received').notNull().default(0),
  change_due: integer('change_due').notNull().default(0),
  notes: text('notes'),
  is_voided: integer('is_voided', { mode: 'boolean' }).notNull().default(false),
  voided_reason: text('voided_reason'),
  voided_by: integer('voided_by').references(() => users.id),
  created_by: integer('created_by').references(() => users.id),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`)
})

/* ────────────────────────── BILL ITEMS ───────────────────────────── */

export const billItems = sqliteTable('bill_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bill_id: integer('bill_id').notNull().references(() => bills.id),
  medicine_id: integer('medicine_id').notNull().references(() => medicines.id),
  quantity: integer('quantity').notNull(),
  unit_price: integer('unit_price').notNull(),
  total: integer('total').notNull()
})

/* ────────────────────── PRESCRIPTIONS ────────────────────────────── */

export const prescriptions = sqliteTable('prescriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  patient_name: text('patient_name').notNull(),
  patient_age: integer('patient_age'),
  doctor_name: text('doctor_name'),
  prescription_date: text('prescription_date'),
  image_path: text('image_path'),
  notes: text('notes'),
  bill_id: integer('bill_id').references(() => bills.id),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`)
})

/* ──────────────────────────── SETTINGS ───────────────────────────── */

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`)
})

/* ────────────────────────── BACKUP LOG ───────────────────────────── */

export const backupLog = sqliteTable('backup_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  file_path: text('file_path').notNull(),
  file_size: integer('file_size'),
  status: text('status', { enum: ['success', 'failed'] }).notNull(),
  error_message: text('error_message'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`)
})

/* ─────────────────────────── AUDIT LOG ───────────────────────────── */

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  table_name: text('table_name'),
  record_id: integer('record_id'),
  details: text('details'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`)
})
