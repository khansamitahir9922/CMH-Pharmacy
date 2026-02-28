import { ipcMain } from 'electron'

/** Register suppliers module IPC handlers */
export function registerSuppliersHandlers(): void {
  ipcMain.handle('suppliers:getAll', async () => {
    // TODO: Fetch all active suppliers
  })

  ipcMain.handle('suppliers:getById', async (_event, _id: unknown) => {
    // TODO: Fetch single supplier by ID
  })

  ipcMain.handle('suppliers:create', async (_event, _data: unknown) => {
    // TODO: Create a new supplier
  })

  ipcMain.handle('suppliers:update', async (_event, _data: unknown) => {
    // TODO: Update an existing supplier
  })

  ipcMain.handle('suppliers:delete', async (_event, _id: unknown) => {
    // TODO: Soft-delete a supplier (set is_active = false)
  })

  ipcMain.handle('suppliers:getPurchaseOrders', async (_event, _supplierId: unknown) => {
    // TODO: Fetch purchase orders for a supplier
  })
}
