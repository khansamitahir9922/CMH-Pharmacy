import { desc } from 'drizzle-orm'
import { getDb } from '../init'
import { backupLog } from '../schema'

export interface BackupLogRow {
  id: number
  file_path: string
  file_size: number | null
  status: 'success' | 'failed'
  error_message: string | null
  created_at: string
}

/**
 * Get backup log entries sorted by date desc.
 */
export function getLogs(limit = 50): BackupLogRow[] {
  const db = getDb()
  return db
    .select()
    .from(backupLog)
    .orderBy(desc(backupLog.created_at))
    .limit(limit)
    .all() as BackupLogRow[]
}

/**
 * Insert a backup log entry.
 */
export function logBackup(entry: {
  file_path: string
  file_size?: number | null
  status: 'success' | 'failed'
  error_message?: string | null
}): void {
  const db = getDb()
  db.insert(backupLog)
    .values({
      file_path: entry.file_path,
      file_size: entry.file_size ?? null,
      status: entry.status,
      error_message: entry.error_message ?? null
    })
    .run()
}
