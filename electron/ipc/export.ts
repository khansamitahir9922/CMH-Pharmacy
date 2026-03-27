import { ipcMain, dialog } from 'electron'
import { writeFileSync } from 'fs'
import * as XLSX from 'xlsx'

export function registerExportHandlers(): void {
  ipcMain.handle(
    'export:saveExcel',
    async (
      _event,
      payload: { filename: string; base64?: string; data?: Record<string, unknown>[]; headers?: string[] }
    ) => {
      const defaultPath = payload?.filename?.endsWith('.xlsx') ? payload.filename : `${payload?.filename ?? 'report'}.xlsx`
      const path = await dialog.showSaveDialog({ defaultPath })
      if (path?.canceled || !path?.filePath) return

      if (payload?.data && Array.isArray(payload.data) && payload?.headers && Array.isArray(payload.headers)) {
        const headers = payload.headers as string[]
        const aoa: unknown[][] = [headers]
        for (const row of payload.data) {
          aoa.push(headers.map((h) => row[h] ?? ''))
        }
        const ws = XLSX.utils.aoa_to_sheet(aoa)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
        writeFileSync(path.filePath, buf)
      } else if (payload?.base64) {
        const buf = Buffer.from(payload.base64, 'base64')
        writeFileSync(path.filePath, buf)
      }
    }
  )

  ipcMain.handle('export:savePdf', async (_event, payload: { filename: string; base64: string }) => {
    const path = await dialog.showSaveDialog({ defaultPath: payload?.filename ?? 'report.pdf' })
    if (path?.canceled || !path?.filePath) return
    const buf = Buffer.from(payload.base64 ?? '', 'base64')
    writeFileSync(path.filePath, buf)
  })
}
