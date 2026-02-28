import { eq } from 'drizzle-orm'
import dayjs from 'dayjs'
import { getDb } from '../init'
import { settings as settingsTable } from '../schema'

export interface SettingRow {
  key: string
  value: string | null
  updated_at: string
}

/**
 * Get all settings as a key-value map.
 */
export function getAll(): Record<string, string | null> {
  const db = getDb()
  const rows = db
    .select({
      key: settingsTable.key,
      value: settingsTable.value
    })
    .from(settingsTable)
    .all() as Array<{ key: string; value: string | null }>

  const out: Record<string, string | null> = {}
  for (const r of rows) out[r.key] = r.value ?? null
  return out
}

/**
 * Get a single setting by key.
 */
export function get(key: string): string | null {
  const db = getDb()
  const k = String(key ?? '').trim()
  if (!k) return null
  const row = db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, k))
    .limit(1)
    .all()[0] as { value: string | null } | undefined
  return row?.value ?? null
}

/**
 * Update a setting value (creates the key if missing).
 */
export function update(key: string, value: string | null): void {
  const db = getDb()
  const k = String(key ?? '').trim()
  if (!k) throw new Error('Setting key is required.')
  const now = dayjs().toISOString()

  const existing = db
    .select({ key: settingsTable.key })
    .from(settingsTable)
    .where(eq(settingsTable.key, k))
    .limit(1)
    .all()[0] as { key: string } | undefined

  if (existing) {
    db.update(settingsTable)
      .set({ value: value ?? null, updated_at: now })
      .where(eq(settingsTable.key, k))
      .run()
    return
  }

  db.insert(settingsTable)
    .values({ key: k, value: value ?? null, updated_at: now })
    .run()
}

