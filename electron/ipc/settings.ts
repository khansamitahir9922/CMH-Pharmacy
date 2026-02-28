import { ipcMain } from 'electron'
import { getAll, get, update, updateAll } from '../../src/db/queries/settings'

/** Register settings module IPC handlers */
export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getAll', async () => getAll())

  ipcMain.handle('settings:getByKey', async (_event, key: string) => get(String(key ?? '')))

  ipcMain.handle('settings:get', async (_event, key: string) => get(String(key ?? '')))

  ipcMain.handle('settings:update', async (_event, data: { key: string; value: string | null }) => {
    if (!data?.key?.trim()) throw new Error('Setting key is required.')
    update(data.key, data.value ?? null)
    return { success: true }
  })

  ipcMain.handle('settings:updateAll', async (_event, payload: Record<string, string | number | null | undefined>) => {
    updateAll(payload ?? {})
    return { success: true }
  })
}
