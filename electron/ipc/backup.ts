import { ipcMain, app, dialog } from 'electron'
import { createWriteStream, existsSync, copyFileSync, unlinkSync, mkdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import archiver from 'archiver'
import AdmZip from 'adm-zip'
import { getDbPath, closeDatabase } from '../../src/db/init'
import { getAll as getSettings, update as updateSetting } from '../../src/db/queries/settings'
import { getLogs as getBackupLogs, logBackup } from '../../src/db/queries/backup'

function formatBackupFilename(): string {
  const d = new Date()
  const Y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `MSMS_Backup_${Y}-${M}-${D}_${h}-${m}-${s}.zip`
}

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:create', async (): Promise<{ success: true; filePath: string; fileSize: number } | { success: false; error: string }> => {
    try {
      const settings = getSettings()
      let backupDir = (settings.backup_folder ?? '').trim()
      if (!backupDir) {
        backupDir = join(app.getPath('userData'), 'backups')
      }
      mkdirSync(backupDir, { recursive: true })
      const dbPath = getDbPath()
      if (!dbPath || !existsSync(dbPath)) {
        return { success: false, error: 'Database file not found.' }
      }
      const filename = formatBackupFilename()
      const outPath = join(backupDir, filename)
      const output = createWriteStream(outPath)
      const archive = archiver('zip', { zlib: { level: 9 } })
      archive.pipe(output)
      archive.file(dbPath, { name: 'skbz-cmh-rawalakot-pharmacy.db' })
      await archive.finalize()
      await new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve())
        archive.on('error', reject)
      })
      const stat = statSync(outPath)
      const fileSize = stat.size
      logBackup({ file_path: outPath, file_size: fileSize, status: 'success' })
      return { success: true, filePath: outPath, fileSize }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Backup failed.'
      try {
        logBackup({ file_path: '', file_size: null, status: 'failed', error_message: msg })
      } catch {}
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(
    'backup:restore',
    async (_event, zipPath: string): Promise<{ success: true } | { success: false; error: string }> => {
      try {
        if (!zipPath || !existsSync(zipPath)) {
          return { success: false, error: 'Backup file not found.' }
        }
        const zip = new AdmZip(zipPath)
        const entries = zip.getEntries()
        const dbEntry = entries.find((e: { entryName: string }) => e.entryName.endsWith('.db'))
        if (!dbEntry || dbEntry.isDirectory) {
          return { success: false, error: 'No database file found in backup.' }
        }
        const dbPath = getDbPath()
        closeDatabase()
        const tempDir = join(app.getPath('temp'), 'msms-restore')
        mkdirSync(tempDir, { recursive: true })
        zip.extractEntryTo(dbEntry, tempDir, false, true)
        const extractedName = dbEntry.entryName.replace(/^.*[\\/]/, '')
        const extractedPath = join(tempDir, extractedName)
        if (!existsSync(extractedPath)) {
          return { success: false, error: 'Extraction failed.' }
        }
        copyFileSync(extractedPath, dbPath)
        unlinkSync(extractedPath)
        return { success: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Restore failed.'
        return { success: false, error: msg }
      }
    }
  )

  ipcMain.handle('backup:getLogs', async () => {
    return getBackupLogs()
  })

  ipcMain.handle('backup:selectFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select backup folder'
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    'backup:setAutoBackup',
    async (
      _event,
      payload: { enabled: boolean; time?: string }
    ): Promise<void> => {
      updateSetting('auto_backup_enabled', payload.enabled ? 'true' : 'false')
      if (payload.time != null) {
        updateSetting('auto_backup_time', String(payload.time))
      }
    }
  )

  ipcMain.handle('backup:showRestoreFileDialog', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select backup file to restore',
      filters: [{ name: 'Backup', extensions: ['zip'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths?.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('backup:getDbFileSize', async (): Promise<{ path: string; sizeBytes: number }> => {
    const path = getDbPath()
    if (!path || !existsSync(path)) return { path: path ?? '', sizeBytes: 0 }
    const stat = statSync(path)
    return { path, sizeBytes: stat.size }
  })
}
