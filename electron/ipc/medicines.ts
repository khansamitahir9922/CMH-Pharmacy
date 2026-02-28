import { ipcMain } from 'electron'
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
  type CreateMedicineInput,
  type UpdateMedicineInput
} from '../../src/db/queries/medicines'

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
    async (_event, data: CreateMedicineInput): Promise<{ id: number }> => {
      if (!data?.name?.trim() || !data?.batch_no?.trim() || !data?.firm_name?.trim()) {
        throw new Error('Name, batch number and manufacturer are required.')
      }
      if (data.opening_stock < 0) throw new Error('Opening stock cannot be negative.')
      if (data.min_stock_level < 1) throw new Error('Minimum stock level must be at least 1.')
      if (data.unit_price_sell < data.unit_price_buy) {
        throw new Error('Sell price must be greater than or equal to buy price.')
      }
      return create(data)
    }
  )

  ipcMain.handle('medicines:update', async (_event, data: UpdateMedicineInput) => {
    if (!data?.id) throw new Error('Medicine ID is required.')
    if (data.unit_price_sell != null && data.unit_price_buy != null && data.unit_price_sell < data.unit_price_buy) {
      throw new Error('Sell price must be greater than or equal to buy price.')
    }
    update(data)
    return getById(data.id)
  })

  ipcMain.handle('medicines:delete', async (_event, id: number) => {
    if (id == null || typeof id !== 'number') throw new Error('Invalid medicine ID.')
    remove(id)
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
}
