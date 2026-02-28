import { ipcMain, dialog } from 'electron'
import { writeFileSync } from 'fs'

export function registerExportHandlers(): void {
  ipcMain.handle('export:saveExcel', async (_event, payload: { filename: string; base64: string }) => {
    const path = await dialog.showSaveDialog({ defaultPath: payload?.filename ?? 'report.xlsx' })
    if (path?.canceled || !path?.filePath) return
    const buf = Buffer.from(payload.base64 ?? '', 'base64')
    writeFileSync(path.filePath, buf)
  })

  ipcMain.handle('export:savePdf', async (_event, payload: { filename: string; base64: string }) => {
    const path = await dialog.showSaveDialog({ defaultPath: payload?.filename ?? 'report.pdf' })
    if (path?.canceled || !path?.filePath) return
    const buf = Buffer.from(payload.base64 ?? '', 'base64')
    writeFileSync(path.filePath, buf)
  })
}
