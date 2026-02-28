import { ipcMain } from 'electron'

/** Register billing module IPC handlers */
export function registerBillingHandlers(): void {
  ipcMain.handle('billing:getAll', async (_event, _filters: unknown) => {
    // TODO: Fetch all bills with optional date/status filters
  })

  ipcMain.handle('billing:getById', async (_event, _id: unknown) => {
    // TODO: Fetch single bill with items
  })

  ipcMain.handle('billing:create', async (_event, _data: unknown) => {
    // TODO: Create a new bill with items, update stock
  })

  ipcMain.handle('billing:void', async (_event, _data: unknown) => {
    // TODO: Void a bill, reverse stock changes
  })

  ipcMain.handle('billing:getNextBillNumber', async () => {
    // TODO: Generate next sequential bill number
  })
}
