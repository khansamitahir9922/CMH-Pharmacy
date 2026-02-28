import { eq, and, desc, sql } from 'drizzle-orm'
import { getDb } from '../init'
import { auditLog, users } from '../schema'

export interface AuditLogRow {
  id: number
  user_id: number | null
  user_name: string | null
  action: string
  table_name: string | null
  record_id: number | null
  details: string | null
  created_at: string
}

export interface GetAuditLogsFilters {
  userId?: number | null
  startDate?: string | null
  endDate?: string | null
  page?: number
  pageSize?: number
}

/**
 * Get audit log entries with optional filters. Returns total and page of rows.
 */
export function getLogs(filters: GetAuditLogsFilters): { data: AuditLogRow[]; total: number } {
  const db = getDb()
  const {
    userId = null,
    startDate = null,
    endDate = null,
    page = 1,
    pageSize = 20
  } = filters ?? {}

  const conditions: unknown[] = []
  if (userId != null && userId > 0) {
    conditions.push(eq(auditLog.user_id, userId))
  }
  if (startDate) {
    conditions.push(sql`substr(${auditLog.created_at}, 1, 10) >= ${String(startDate).slice(0, 10)}`)
  }
  if (endDate) {
    conditions.push(sql`substr(${auditLog.created_at}, 1, 10) <= ${String(endDate).slice(0, 10)}`)
  }
  const whereClause =
    conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...(conditions as never[]))

  const all = db
    .select({
      id: auditLog.id,
      user_id: auditLog.user_id,
      action: auditLog.action,
      table_name: auditLog.table_name,
      record_id: auditLog.record_id,
      details: auditLog.details,
      created_at: auditLog.created_at,
      user_name: users.full_name
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.user_id, users.id))
    .where(whereClause)
    .orderBy(desc(auditLog.created_at))
    .all() as Array<{
    id: number
    user_id: number | null
    action: string
    table_name: string | null
    record_id: number | null
    details: string | null
    created_at: string
    user_name: string | null
  }>

  const total = all.length
  const offset = (Math.max(1, page) - 1) * Math.max(1, pageSize)
  const slice = all.slice(offset, offset + pageSize)

  const data: AuditLogRow[] = slice.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    user_name: r.user_name ?? null,
    action: r.action,
    table_name: r.table_name ?? null,
    record_id: r.record_id ?? null,
    details: r.details ?? null,
    created_at: r.created_at
  }))

  return { data, total }
}

/**
 * Insert an audit log entry. Call this from IPC or services when actions occur.
 */
export function log(
  payload: {
    user_id?: number | null
    action: string
    table_name?: string | null
    record_id?: number | null
    details?: string | null
  }
): void {
  const db = getDb()
  db.insert(auditLog)
    .values({
      user_id: payload.user_id ?? null,
      action: payload.action,
      table_name: payload.table_name ?? null,
      record_id: payload.record_id ?? null,
      details: payload.details ?? null
    })
    .run()
}
