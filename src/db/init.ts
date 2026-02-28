import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let db: BetterSQLite3Database<typeof schema> | null = null
let sqlite: Database.Database | null = null

/**
 * Opens (or creates) the SQLite database, runs all migrations,
 * seeds default data, and returns a Drizzle ORM instance.
 */
export function initDatabase(dbPath: string): BetterSQLite3Database<typeof schema> {
  sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  createTables(sqlite)
  migrateMedicinesBarcode(sqlite)
  migratePrescriptionsColumns(sqlite)
  seedDefaults(sqlite)

  db = drizzle(sqlite, { schema })
  return db
}

/** Returns the active Drizzle database instance. */
export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!db) throw new Error('Database not initialized — call initDatabase() first')
  return db
}

/** Returns the raw better-sqlite3 instance for direct queries when needed. */
export function getSqlite(): Database.Database {
  if (!sqlite) throw new Error('Database not initialized — call initDatabase() first')
  return sqlite
}

function createTables(conn: Database.Database): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      username        TEXT    NOT NULL UNIQUE,
      password_hash   TEXT    NOT NULL,
      full_name       TEXT    NOT NULL,
      role            TEXT    NOT NULL CHECK(role IN ('admin','manager','pharmacist','dataentry')),
      is_active       INTEGER NOT NULL DEFAULT 1,
      last_login      TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medicine_categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      description TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      category_id     INTEGER REFERENCES medicine_categories(id),
      batch_no        TEXT,
      barcode         TEXT,
      mfg_date        TEXT,
      expiry_date     TEXT,
      received_date   TEXT,
      order_date      TEXT,
      firm_name       TEXT,
      opening_stock   INTEGER NOT NULL DEFAULT 0,
      unit_price_buy  INTEGER NOT NULL DEFAULT 0,
      unit_price_sell INTEGER NOT NULL DEFAULT 0,
      min_stock_level INTEGER NOT NULL DEFAULT 10,
      shelf_location  TEXT,
      notes           TEXT,
      is_deleted      INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id      INTEGER NOT NULL UNIQUE REFERENCES medicines(id),
      current_quantity INTEGER NOT NULL DEFAULT 0,
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_transactions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id      INTEGER NOT NULL REFERENCES medicines(id),
      transaction_type TEXT    NOT NULL CHECK(transaction_type IN ('in','out','adjust','return')),
      quantity         INTEGER NOT NULL,
      reason           TEXT,
      reference_id     INTEGER,
      reference_type   TEXT,
      performed_by     INTEGER REFERENCES users(id),
      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT    NOT NULL,
      contact_person TEXT,
      phone          TEXT,
      email          TEXT,
      address        TEXT,
      ntn_cnic       TEXT,
      notes          TEXT,
      is_active      INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number  TEXT    NOT NULL UNIQUE,
      supplier_id   INTEGER REFERENCES suppliers(id),
      order_date    TEXT    NOT NULL,
      expected_date TEXT,
      received_date TEXT,
      status        TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','partial','received','cancelled')),
      total_amount  INTEGER NOT NULL DEFAULT 0,
      paid_amount   INTEGER NOT NULL DEFAULT 0,
      notes         TEXT,
      created_by    INTEGER REFERENCES users(id),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
      medicine_id       INTEGER NOT NULL REFERENCES medicines(id),
      quantity_ordered  INTEGER NOT NULL,
      quantity_received INTEGER NOT NULL DEFAULT 0,
      unit_price        INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bills (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number      TEXT    NOT NULL UNIQUE,
      customer_name    TEXT,
      customer_phone   TEXT,
      subtotal         INTEGER NOT NULL DEFAULT 0,
      discount_percent INTEGER NOT NULL DEFAULT 0,
      tax_percent      INTEGER NOT NULL DEFAULT 0,
      total_amount     INTEGER NOT NULL DEFAULT 0,
      payment_mode     TEXT    NOT NULL DEFAULT 'cash' CHECK(payment_mode IN ('cash','card','credit')),
      amount_received  INTEGER NOT NULL DEFAULT 0,
      change_due       INTEGER NOT NULL DEFAULT 0,
      notes            TEXT,
      is_voided        INTEGER NOT NULL DEFAULT 0,
      voided_reason    TEXT,
      voided_by        INTEGER REFERENCES users(id),
      created_by       INTEGER REFERENCES users(id),
      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id     INTEGER NOT NULL REFERENCES bills(id),
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      quantity    INTEGER NOT NULL,
      unit_price  INTEGER NOT NULL,
      total       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_name         TEXT    NOT NULL,
      patient_age          INTEGER,
      doctor_name          TEXT,
      prescription_date    TEXT,
      medicines_prescribed TEXT,
      image_path           TEXT,
      notes                TEXT,
      bill_id              INTEGER REFERENCES bills(id),
      is_deleted           INTEGER NOT NULL DEFAULT 0,
      created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key        TEXT    NOT NULL UNIQUE,
      value      TEXT,
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS backup_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path     TEXT    NOT NULL,
      file_size     INTEGER,
      status        TEXT    NOT NULL CHECK(status IN ('success','failed')),
      error_message TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id),
      action     TEXT    NOT NULL,
      table_name TEXT,
      record_id  INTEGER,
      details    TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

/** Add barcode column to medicines if missing (for existing DBs). */
function migrateMedicinesBarcode(conn: Database.Database): void {
  const rows = conn.prepare("PRAGMA table_info(medicines)").all() as Array<{ name: string }>
  if (rows.some((r) => r.name === 'barcode')) return
  conn.exec('ALTER TABLE medicines ADD COLUMN barcode TEXT')
}

/** Add medicines_prescribed and is_deleted to prescriptions if missing. */
function migratePrescriptionsColumns(conn: Database.Database): void {
  const rows = conn.prepare("PRAGMA table_info(prescriptions)").all() as Array<{ name: string }>
  const names = new Set(rows.map((r) => r.name))
  if (!names.has('medicines_prescribed')) conn.exec('ALTER TABLE prescriptions ADD COLUMN medicines_prescribed TEXT')
  if (!names.has('is_deleted')) conn.exec('ALTER TABLE prescriptions ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0')
}

function seedDefaults(conn: Database.Database): void {
  const insertCategory = conn.prepare(
    'INSERT OR IGNORE INTO medicine_categories (name) VALUES (?)'
  )

  const defaultCategories = [
    'Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream',
    'Ointment', 'Drop', 'Inhaler', 'Powder', 'Other'
  ]

  for (const name of defaultCategories) {
    insertCategory.run(name)
  }

  const insertSetting = conn.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  )

  const defaultSettings: [string, string][] = [
    ['pharmacy_name', 'SKBZ/CMH RAWALAKOT PHARMACY'],
    ['pharmacy_address', ''],
    ['pharmacy_phone', ''],
    ['gst_percent', '0'],
    ['currency_symbol', 'Rs.'],
    ['session_timeout_minutes', '30'],
    ['backup_folder', ''],
    ['auto_backup_enabled', 'false']
  ]

  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value)
  }
}
