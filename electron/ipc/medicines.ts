import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile } from 'fs/promises'
import {
  getAll,
  getById,
  create,
  update,
  remove,
  getCategories,
  search,
  exportData,
  seedDummyMedicines,
  importFromExcel,
  type CreateMedicineInput,
  type UpdateMedicineInput
} from '../../src/db/queries/medicines'
import { log as auditLog } from '../../src/db/queries/audit'

export interface GetAllPayload {
  search?: string
  categoryId?: number | null
  expiryStatus?: 'all' | 'expired' | 'warning30' | 'warning90' | 'ok'
  stockStatus?: 'all' | 'low' | 'out'
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'expiry_date' | 'current_quantity'
  sortOrder?: 'asc' | 'desc'
}

/** Register medicines module IPC handlers */
export function registerMedicinesHandlers(): void {
  ipcMain.handle(
    'medicines:getAll',
    async (_event, payload: GetAllPayload): Promise<{ data: unknown[]; total: number }> => {
      const result = getAll({
        search: payload?.search ?? '',
        categoryId: payload?.categoryId ?? null,
        expiryStatus: payload?.expiryStatus ?? 'all',
        stockStatus: payload?.stockStatus ?? 'all',
        page: payload?.page ?? 1,
        pageSize: payload?.pageSize ?? 20,
        sortBy: payload?.sortBy ?? 'name',
        sortOrder: payload?.sortOrder ?? 'asc'
      })
      return result
    }
  )

  ipcMain.handle('medicines:getById', async (_event, id: number) => {
    if (id == null || typeof id !== 'number') return null
    return getById(id)
  })

  ipcMain.handle(
    'medicines:create',
    async (_event, data: CreateMedicineInput & { userId?: number }): Promise<{ id: number }> => {
      if (!data?.name?.trim() || !data?.batch_no?.trim() || !data?.firm_name?.trim()) {
        throw new Error('Name, batch number and manufacturer are required.')
      }
      if (data.opening_stock < 0) throw new Error('Opening stock cannot be negative.')
      if (data.min_stock_level < 1) throw new Error('Minimum stock level must be at least 1.')
      const buy = data.unit_price_buy ?? 0
      const sell = data.unit_price_sell ?? 0
      if (buy > 0 && sell > 0 && sell < buy) {
        throw new Error('Sell price must be greater than or equal to buy price when both are set.')
      }
      const { userId, ...input } = data
      const result = create(input)
      auditLog({
        user_id: userId ?? null,
        action: 'Create medicine',
        table_name: 'medicines',
        record_id: result.id,
        details: input.name
      })
      return result
    }
  )

  ipcMain.handle('medicines:update', async (_event, data: UpdateMedicineInput & { userId?: number }) => {
    if (!data?.id) throw new Error('Medicine ID is required.')
    const buy = data.unit_price_buy ?? 0
    const sell = data.unit_price_sell ?? 0
    if (buy > 0 && sell > 0 && sell < buy) {
      throw new Error('Sell price must be greater than or equal to buy price when both are set.')
    }
    const { userId, ...input } = data
    update(input)
    const updated = getById(data.id)
    auditLog({
      user_id: userId ?? null,
      action: 'Update medicine',
      table_name: 'medicines',
      record_id: data.id,
      details: updated?.name ?? null
    })
    return updated
  })

  ipcMain.handle('medicines:delete', async (_event, payload: number | { id: number; userId?: number }) => {
    const id = typeof payload === 'object' && payload != null && 'id' in payload ? payload.id : payload
    const userId = typeof payload === 'object' && payload != null && 'userId' in payload ? payload.userId : undefined
    if (id == null || typeof id !== 'number') throw new Error('Invalid medicine ID.')
    const before = getById(id)
    remove(id)
    auditLog({
      user_id: userId ?? null,
      action: 'Delete medicine',
      table_name: 'medicines',
      record_id: id,
      details: before?.name ?? null
    })
  })

  ipcMain.handle('medicines:getCategories', async () => {
    return getCategories()
  })

  ipcMain.handle('medicines:search', async (_event, term: string) => {
    return search(String(term ?? ''))
  })

  ipcMain.handle('medicines:exportData', async () => {
    return exportData()
  })

  ipcMain.handle('medicines:seedDummy', async (_event, count?: number) => {
    const n = Math.min(Math.max(1, Number(count) || 10_000), 50_000)
    return seedDummyMedicines(n)
  })

  ipcMain.handle(
    'medicines:importFromExcel',
    async (event): Promise<{ imported: number; failed: number; errors: { row: number; message: string }[]; canceled?: boolean }> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(win!, {
        title: 'Select Excel file to import',
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile']
      })
      if (result.canceled || !result.filePaths.length) {
        return { imported: 0, failed: 0, errors: [], canceled: true }
      }
      const buffer = await readFile(result.filePaths[0])
      return importFromExcel(buffer)
    }
  )
}
