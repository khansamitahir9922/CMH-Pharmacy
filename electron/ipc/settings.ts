import { ipcMain } from 'electron'
import { getAll, get, update } from '../../src/db/queries/settings'

/** Register settings module IPC handlers */
export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getAll', async () => {
    return getAll()
  })

  ipcMain.handle('settings:get', async (_event, key: string) => {
    return get(String(key ?? ''))
  })

  ipcMain.handle('settings:update', async (_event, data: { key: string; value: string | null }) => {
    if (!data?.key?.trim()) throw new Error('Setting key is required.')
    update(data.key, data.value ?? null)
    return { success: true }
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
