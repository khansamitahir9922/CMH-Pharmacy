import { ipcMain } from 'electron'
import {
  getSalesReport,
  getStockBalance,
  getPurchasesReport,
  getMedicineIssues,
  getAdjustmentLog,
  getStockVarianceReport,
  getPurchaseVsConsumptionReport,
  getControlledDrugRegister
} from '../../src/db/queries/reports'

export function registerReportsHandlers(): void {
  ipcMain.handle('reports:getSales', async (_event, payload: { startDate: string; endDate: string }) => {
    const start = String(payload?.startDate ?? '').slice(0, 10)
    const end = String(payload?.endDate ?? '').slice(0, 10)
    if (!start || !end) throw new Error('Start and end date are required.')
    return getSalesReport(start, end)
  })

  ipcMain.handle(
    'reports:getStockBalance',
    async (_event, payload: { asOfDate: string; categoryId?: number | null }) => {
      const asOf = String(payload?.asOfDate ?? '').slice(0, 10)
      if (!asOf) throw new Error('As of date is required.')
      return getStockBalance(asOf, payload?.categoryId ?? null)
    }
  )

  ipcMain.handle(
    'reports:getPurchases',
    async (_event, payload: { startDate: string; endDate: string; supplierId?: number | null }) => {
      const start = String(payload?.startDate ?? '').slice(0, 10)
      const end = String(payload?.endDate ?? '').slice(0, 10)
      if (!start || !end) throw new Error('Start and end date are required.')
      return getPurchasesReport(start, end, payload?.supplierId ?? null)
    }
  )

  ipcMain.handle(
    'reports:getMedicineIssues',
    async (_event, payload: { startDate: string; endDate: string; medicineId?: number | null }) => {
      const start = String(payload?.startDate ?? '').slice(0, 10)
      const end = String(payload?.endDate ?? '').slice(0, 10)
      if (!start || !end) throw new Error('Start and end date are required.')
      return getMedicineIssues(start, end, payload?.medicineId ?? null)
    }
  )

  ipcMain.handle(
    'reports:getAdjustmentLog',
    async (_event, payload: { startDate: string; endDate: string; userId?: number | null }) => {
      const start = String(payload?.startDate ?? '').slice(0, 10)
      const end = String(payload?.endDate ?? '').slice(0, 10)
      if (!start || !end) throw new Error('Start and end date are required.')
      return getAdjustmentLog(start, end, payload?.userId ?? null)
    }
  )

  ipcMain.handle(
    'reports:getStockVariance',
    async (_event, payload: { startDate: string; endDate: string }) => {
      const start = String(payload?.startDate ?? '').slice(0, 10)
      const end = String(payload?.endDate ?? '').slice(0, 10)
      if (!start || !end) throw new Error('Start and end date are required.')
      return getStockVarianceReport(start, end)
    }
  )

  ipcMain.handle(
    'reports:getPurchaseVsConsumption',
    async (_event, payload: { startDate: string; endDate: string }) => {
      const start = String(payload?.startDate ?? '').slice(0, 10)
      const end = String(payload?.endDate ?? '').slice(0, 10)
      if (!start || !end) throw new Error('Start and end date are required.')
      return getPurchaseVsConsumptionReport(start, end)
    }
  )

  ipcMain.handle('reports:getControlledDrugRegister', async () => {
    return getControlledDrugRegister()
  })
}
