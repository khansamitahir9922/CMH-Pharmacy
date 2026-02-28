import { ipcMain } from 'electron'

/** Register settings module IPC handlers */
export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getAll', async () => {
    // TODO: Fetch all settings as key-value pairs
  })

  ipcMain.handle('settings:get', async (_event, _key: unknown) => {
    // TODO: Fetch a single setting by key
  })

  ipcMain.handle('settings:update', async (_event, _data: unknown) => {
    // TODO: Update a setting value
  })

  ipcMain.handle('settings:getUsers', async () => {
    // TODO: Fetch all user accounts (admin only)
  })

  ipcMain.handle('settings:createUser', async (_event, _data: unknown) => {
    // TODO: Create a new user account
  })

  ipcMain.handle('settings:updateUser', async (_event, _data: unknown) => {
    // TODO: Update user account details
  })
}
