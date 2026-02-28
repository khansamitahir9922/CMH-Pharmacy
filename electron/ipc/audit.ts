import { ipcMain } from 'electron'
import { getLogs } from '../../src/db/queries/audit'

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
}
