import { ipcMain } from 'electron'
import dayjs from 'dayjs'
import { getSqlite } from '../../src/db/init'
import {
  createBill,
  getBills,
  getBillById,
  voidBill,
  getDailySummary,
  type PaymentMode,
  type GetBillsFilters
} from '../../src/db/queries/billing'

interface CreateBillPayload {
  customer?: { name?: string | null; phone?: string | null } | null
  items: Array<{ medicineId: number; quantity: number; unitPrice: number }>
  discount?: { percent?: number } | null
  tax?: { percent?: number } | null
  paymentMode: PaymentMode
  received?: number | null
  createdBy?: number | null
}

/** Register billing module IPC handlers */
export function registerBillingHandlers(): void {
  ipcMain.handle('billing:createBill', async (_event, payload: CreateBillPayload) => {
    if (!payload?.items?.length) throw new Error('Add at least one medicine to generate a bill.')
    const discountPercent = payload?.discount?.percent ?? 0
    const taxPercent = payload?.tax?.percent ?? 0
    return createBill({
      customerName: payload?.customer?.name ?? null,
      customerPhone: payload?.customer?.phone ?? null,
      items: payload.items.map((it) => ({
        medicineId: it.medicineId,
        quantity: it.quantity,
        unitPrice: it.unitPrice
      })),
      discountPercent,
      taxPercent,
      paymentMode: payload.paymentMode,
      amountReceived: payload.received ?? null,
      createdBy: payload.createdBy ?? null
    })
  })

  ipcMain.handle('billing:getBills', async (_event, filters: GetBillsFilters) => {
    return getBills(filters ?? {})
  })

  ipcMain.handle('billing:getBillById', async (_event, billId: number) => {
    if (billId == null || typeof billId !== 'number') throw new Error('Invalid bill id.')
    return getBillById(billId)
  })

  ipcMain.handle('billing:voidBill', async (_event, payload: { billId: number; reason: string; voidedBy: number }) => {
    if (!payload?.billId || typeof payload.billId !== 'number') throw new Error('Invalid bill id.')
    if (!payload?.reason?.trim()) throw new Error('Void reason is required.')
    if (!payload?.voidedBy || typeof payload.voidedBy !== 'number') throw new Error('Voided by user is required.')
    voidBill({ billId: payload.billId, reason: payload.reason, voidedBy: payload.voidedBy })
  })

  ipcMain.handle('billing:getDailySummary', async (_event, date: string) => {
    return getDailySummary(String(date ?? ''))
  })

  // Backward-compatible aliases (legacy channel names)
  ipcMain.handle('billing:getAll', async (_event, filters: GetBillsFilters) => {
    return getBills({ ...(filters ?? {}), includeVoided: true })
  })

  ipcMain.handle('billing:getById', async (_event, id: number) => {
    return getBillById(Number(id))
  })

  ipcMain.handle('billing:create', async (_event, payload: CreateBillPayload) => {
    return createBill({
      customerName: payload?.customer?.name ?? null,
      customerPhone: payload?.customer?.phone ?? null,
      items: payload?.items ?? [],
      discountPercent: payload?.discount?.percent ?? 0,
      taxPercent: payload?.tax?.percent ?? 0,
      paymentMode: payload?.paymentMode ?? 'cash',
      amountReceived: payload?.received ?? null,
      createdBy: payload?.createdBy ?? null
    })
  })

  ipcMain.handle('billing:void', async (_event, payload: { billId: number; reason: string; voidedBy: number }) => {
    voidBill({ billId: payload.billId, reason: payload.reason, voidedBy: payload.voidedBy })
  })

  ipcMain.handle('billing:getNextBillNumber', async () => {
    const sqlite = getSqlite()
    const datePart = dayjs().format('YYYYMMDD')
    const last = sqlite
      .prepare(`SELECT bill_number FROM bills WHERE bill_number LIKE ? ORDER BY bill_number DESC LIMIT 1`)
      .get(`BILL-${datePart}-%`) as { bill_number?: string } | undefined
    const lastNumber = String(last?.bill_number ?? '')
    const lastSuffix = lastNumber.split('-').pop()
    const seq = (lastSuffix && /^\d+$/.test(lastSuffix)) ? parseInt(lastSuffix, 10) : 0
    return `BILL-${datePart}-${String(seq + 1).padStart(4, '0')}`
  })
}
