import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDatabase } from '../src/db/init'
import { registerAuthHandlers } from './ipc/auth'
import { registerMedicinesHandlers } from './ipc/medicines'
import { registerInventoryHandlers } from './ipc/inventory'
import { registerSuppliersHandlers } from './ipc/suppliers'
import { registerBillingHandlers } from './ipc/billing'
import { registerPrescriptionsHandlers } from './ipc/prescriptions'
import { registerReportsHandlers } from './ipc/reports'
import { registerSettingsHandlers } from './ipc/settings'
import { registerBackupHandlers } from './ipc/backup'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'SKBZ/CMH RAWALAKOT PHARMACY',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  const dbPath = join(app.getPath('userData'), 'skbz-cmh-rawalakot-pharmacy.db')
  initDatabase(dbPath)

  registerAuthHandlers()
  registerMedicinesHandlers()
  registerInventoryHandlers()
  registerSuppliersHandlers()
  registerBillingHandlers()
  registerPrescriptionsHandlers()
  registerReportsHandlers()
  registerSettingsHandlers()
  registerBackupHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
