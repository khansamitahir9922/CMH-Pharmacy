import { ipcMain } from 'electron'

/** Register prescriptions module IPC handlers */
export function registerPrescriptionsHandlers(): void {
  ipcMain.handle('prescriptions:getAll', async (_event, _filters: unknown) => {
    // TODO: Fetch all prescriptions with optional filters
  })

  ipcMain.handle('prescriptions:getById', async (_event, _id: unknown) => {
    // TODO: Fetch single prescription by ID
  })

  ipcMain.handle('prescriptions:create', async (_event, _data: unknown) => {
    // TODO: Create a new prescription record
  })

  ipcMain.handle('prescriptions:update', async (_event, _data: unknown) => {
    // TODO: Update an existing prescription
  })

  ipcMain.handle('prescriptions:delete', async (_event, _id: unknown) => {
    // TODO: Delete a prescription record
  })
}
