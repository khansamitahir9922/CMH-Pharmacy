import { ipcMain } from 'electron'
import {
  getSummary,
  getLowStock,
  getExpiringSoon,
  getExpired,
  recordTransaction,
  getTransactions,
  getExpiryReport,
  type RecordTransactionInput,
  type GetTransactionsFilters
} from '../../src/db/queries/inventory'

export interface GetExpiringSoonPayload {
  days?: number
  limit?: number
}

export interface RecordTransactionPayload {
  medicineId: number
  type: 'in' | 'out' | 'adjust'
  quantity: number
  reason: string
  date: string
  notes?: string | null
  performedBy?: number | null
}

/** Register inventory module IPC handlers */
export function registerInventoryHandlers(): void {
  ipcMain.handle('inventory:getSummary', async (): Promise<{
    totalMedicines: number
    lowStock: number
    expiringThisMonth: number
    expired: number
  }> => {
    return getSummary()
  })

  ipcMain.handle('inventory:getLowStock', async (_event, limit?: number) => {
    return getLowStock(limit ?? 10)
  })

  ipcMain.handle('inventory:getExpiringSoon', async (_event, payload: GetExpiringSoonPayload) => {
    const days = payload?.days ?? 30
    const limit = payload?.limit ?? 10
    return getExpiringSoon(days, limit, true)
  })

  ipcMain.handle('inventory:getExpired', async () => {
    return getExpired(100)
  })

  ipcMain.handle(
    'inventory:recordTransaction',
    async (_event, data: RecordTransactionPayload): Promise<void> => {
      if (!data?.medicineId || !data?.type || data?.quantity == null || data?.quantity <= 0) {
        throw new Error('Medicine, type, and positive quantity are required.')
      }
      if (!data.reason?.trim()) throw new Error('Reason is required.')
      const input: RecordTransactionInput = {
        medicineId: data.medicineId,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason.trim(),
        date: data.date || new Date().toISOString().slice(0, 10),
        notes: data.notes ?? null,
        performedBy: data.performedBy ?? null
      }
      recordTransaction(input)
    }
  )

  ipcMain.handle(
    'inventory:getTransactions',
    async (
      _event,
      filters: GetTransactionsFilters
    ): Promise<{ data: unknown[]; total: number }> => {
      return getTransactions(filters ?? {})
    }
  )

  ipcMain.handle('inventory:getExpiryReport', async () => {
    return getExpiryReport()
  })
}
