import { ipcMain, app } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import {
  getAll,
  getById,
  create,
  update,
  remove,
  type GetAllPrescriptionsFilters,
  type CreatePrescriptionInput,
  type UpdatePrescriptionInput
} from '../../src/db/queries/prescriptions'

function getPrescriptionsDir(): string {
  const dir = join(app.getPath('userData'), 'prescriptions')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Save base64 image data to app data prescriptions folder. Returns relative path for DB storage.
 */
function saveImageToDisk(base64Data: string, extension: string): string {
  const dir = getPrescriptionsDir()
  const base64 = String(base64Data ?? '').replace(/^data:image\/\w+;base64,/, '')
  if (!base64) throw new Error('No image data provided.')
  const filename = `rx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
  const filePath = join(dir, filename)
  const buf = Buffer.from(base64, 'base64')
  writeFileSync(filePath, buf)
  return filePath
}

/**
 * Delete a prescription image file from disk if it exists.
 */
function deleteImageFile(imagePath: string | null): void {
  if (!imagePath || !String(imagePath).trim()) return
  try {
    if (existsSync(imagePath)) unlinkSync(imagePath)
  } catch {
    // ignore
  }
}

export function registerPrescriptionsHandlers(): void {
  ipcMain.handle('prescriptions:getAll', async (_event, filters: GetAllPrescriptionsFilters) => {
    return getAll(filters ?? {})
  })

  ipcMain.handle('prescriptions:getById', async (_event, id: number) => {
    if (id == null || typeof id !== 'number') return null
    return getById(id)
  })

  ipcMain.handle('prescriptions:create', async (_event, data: CreatePrescriptionInput) => {
    if (!data?.patient_name?.trim()) throw new Error('Patient name is required.')
    if (!data?.doctor_name?.trim()) throw new Error('Doctor name is required.')
    if (!data?.prescription_date) throw new Error('Prescription date is required.')
    return create({
      patient_name: data.patient_name.trim(),
      patient_age: data.patient_age ?? null,
      doctor_name: data.doctor_name.trim(),
      prescription_date: String(data.prescription_date).slice(0, 10),
      medicines_prescribed: data.medicines_prescribed ?? null,
      image_path: data.image_path ?? null,
      notes: data.notes ?? null,
      bill_id: data.bill_id ?? null
    })
  })

  ipcMain.handle('prescriptions:update', async (_event, data: UpdatePrescriptionInput) => {
    if (!data?.id) throw new Error('Prescription ID is required.')
    update(data)
    return getById(data.id)
  })

  ipcMain.handle('prescriptions:delete', async (_event, id: number) => {
    if (id == null || typeof id !== 'number') throw new Error('Invalid prescription ID.')
    const { image_path } = remove(id)
    deleteImageFile(image_path)
  })

  ipcMain.handle(
    'prescriptions:saveImage',
    async (_event, payload: { base64: string; extension: string }) => {
      const ext = payload?.extension === 'pdf' ? 'pdf' : payload?.extension === 'png' ? 'png' : 'jpg'
      return saveImageToDisk(payload?.base64 ?? '', ext)
    }
  )
}
