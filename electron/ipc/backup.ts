import { ipcMain } from 'electron'

/** Register backup module IPC handlers */
export function registerBackupHandlers(): void {
  ipcMain.handle('backup:create', async () => {
    // TODO: Create a database backup (zip the .db file)
  })

  ipcMain.handle('backup:restore', async (_event, _filePath: unknown) => {
    // TODO: Restore database from a backup file
  })

  ipcMain.handle('backup:getHistory', async () => {
    // TODO: Fetch backup history from backup_log
  })

  ipcMain.handle('backup:selectFolder', async () => {
    // TODO: Open native folder picker for backup destination
  })
}
