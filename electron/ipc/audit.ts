import { ipcMain } from 'electron'
import { getLogs, log as auditLog, getUserActivitySummary } from '../../src/db/queries/audit'

export interface GetAuditLogsPayload {
  userId?: number | null
  startDate?: string | null
  endDate?: string | null
  page?: number
  pageSize?: number
}

export function registerAuditHandlers(): void {
  ipcMain.handle('audit:getLogs', async (_event, payload: GetAuditLogsPayload) => {
    return getLogs(payload ?? {})
  })

  ipcMain.handle(
    'audit:logReportView',
    async (_event, payload: { reportName: string; userId?: number | null }) => {
      auditLog({
        user_id: payload?.userId ?? null,
        action: 'View report',
        table_name: 'reports',
        details: payload?.reportName ?? 'Report'
      })
    }
  )

  ipcMain.handle(
    'audit:getUserActivitySummary',
    async (
      _event,
      payload: { userId: number; startDate?: string | null; endDate?: string | null }
    ) => {
      return getUserActivitySummary(payload?.userId ?? 0, payload?.startDate ?? null, payload?.endDate ?? null)
    }
  )

  ipcMain.handle(
    'audit:logAction',
    async (_event, payload: { userId?: number | null; action: string; details?: string | null }) => {
      auditLog({
        user_id: payload?.userId ?? null,
        action: payload?.action ?? 'Action',
        table_name: 'audit_log',
        details: payload?.details ?? null
      })
    }
  )
}
