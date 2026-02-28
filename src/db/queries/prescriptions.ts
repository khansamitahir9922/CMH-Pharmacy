import { eq, and, like, or, desc, sql } from 'drizzle-orm'
import { getDb } from '../init'
import { prescriptions, bills } from '../schema'

export interface PrescriptionRow {
  id: number
  patient_name: string
  patient_age: number | null
  doctor_name: string | null
  prescription_date: string | null
  medicines_prescribed: string | null
  image_path: string | null
  notes: string | null
  bill_id: number | null
  is_deleted: boolean
  created_at: string
}

export interface PrescriptionListRow extends PrescriptionRow {
  medicines_count: number
  has_image: boolean
  linked_bill_number: string | null
}

export interface GetAllPrescriptionsFilters {
  search?: string | null
  page?: number
  pageSize?: number
}

export interface CreatePrescriptionInput {
  patient_name: string
  patient_age: number | null
  doctor_name: string
  prescription_date: string
  medicines_prescribed: string | null
  image_path: string | null
  notes: string | null
  bill_id: number | null
}

export type UpdatePrescriptionInput = Partial<CreatePrescriptionInput> & { id: number }

function countMedicinesLines(text: string | null): number {
  if (!text || !String(text).trim()) return 0
  return String(text)
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean).length
}

/**
 * Get paginated prescriptions with optional search (patient name or doctor name).
 */
export function getAll(filters: GetAllPrescriptionsFilters): { data: PrescriptionListRow[]; total: number } {
  const db = getDb()
  const { search = null, page = 1, pageSize = 20 } = filters ?? {}

  const conditions: unknown[] = [eq(prescriptions.is_deleted, false)]
  if (search?.trim()) {
    const term = `%${search.trim()}%`
    conditions.push(or(like(prescriptions.patient_name, term), like(prescriptions.doctor_name, term))!)
  }
  const whereClause = conditions.length === 1 ? conditions[0] : and(...(conditions as never[]))

  const all = db
    .select({
      id: prescriptions.id,
      patient_name: prescriptions.patient_name,
      patient_age: prescriptions.patient_age,
      doctor_name: prescriptions.doctor_name,
      prescription_date: prescriptions.prescription_date,
      medicines_prescribed: prescriptions.medicines_prescribed,
      image_path: prescriptions.image_path,
      notes: prescriptions.notes,
      bill_id: prescriptions.bill_id,
      is_deleted: prescriptions.is_deleted,
      created_at: prescriptions.created_at,
      bill_number: bills.bill_number
    })
    .from(prescriptions)
    .leftJoin(bills, eq(prescriptions.bill_id, bills.id))
    .where(whereClause)
    .orderBy(desc(prescriptions.created_at))
    .all() as Array<{
    id: number
    patient_name: string
    patient_age: number | null
    doctor_name: string | null
    prescription_date: string | null
    medicines_prescribed: string | null
    image_path: string | null
    notes: string | null
    bill_id: number | null
    is_deleted: boolean | number
    created_at: string
    bill_number: string | null
  }>

  const total = all.length
  const offset = (Math.max(1, page) - 1) * Math.max(1, pageSize)
  const slice = all.slice(offset, offset + pageSize)

  const data: PrescriptionListRow[] = slice.map((r) => ({
    id: r.id,
    patient_name: r.patient_name,
    patient_age: r.patient_age,
    doctor_name: r.doctor_name ?? null,
    prescription_date: r.prescription_date ?? null,
    medicines_prescribed: r.medicines_prescribed ?? null,
    image_path: r.image_path ?? null,
    notes: r.notes ?? null,
    bill_id: r.bill_id ?? null,
    is_deleted: !!r.is_deleted,
    created_at: r.created_at,
    medicines_count: countMedicinesLines(r.medicines_prescribed),
    has_image: !!(r.image_path && String(r.image_path).trim()),
    linked_bill_number: r.bill_number ?? null
  }))

  return { data, total }
}

/**
 * Get a single prescription by ID.
 */
export function getById(id: number): PrescriptionRow | null {
  const db = getDb()
  const rows = db.select().from(prescriptions).where(eq(prescriptions.id, id)).limit(1).all()
  const r = rows[0]
  if (!r || (r as { is_deleted?: boolean | number }).is_deleted) return null
  return {
    ...r,
    is_deleted: !!(r as { is_deleted?: boolean | number }).is_deleted
  } as PrescriptionRow
}

/**
 * Create a new prescription.
 */
export function create(input: CreatePrescriptionInput): { id: number } {
  const db = getDb()
  const result = db
    .insert(prescriptions)
    .values({
      patient_name: input.patient_name.trim(),
      patient_age: input.patient_age,
      doctor_name: input.doctor_name?.trim() ?? null,
      prescription_date: input.prescription_date || null,
      medicines_prescribed: input.medicines_prescribed?.trim() || null,
      image_path: input.image_path || null,
      notes: input.notes?.trim() || null,
      bill_id: input.bill_id ?? null,
      is_deleted: false
    })
    .returning({ id: prescriptions.id })
    .all()
  const row = result[0]
  if (!row) throw new Error('Failed to create prescription')
  return { id: row.id }
}

/**
 * Update an existing prescription.
 */
export function update(input: UpdatePrescriptionInput): void {
  const db = getDb()
  const { id, ...rest } = input
  const updates: Record<string, unknown> = { ...rest }
  if (updates.patient_name != null) updates.patient_name = String(updates.patient_name).trim()
  if (updates.doctor_name != null) updates.doctor_name = String(updates.doctor_name).trim()
  if (updates.medicines_prescribed != null) updates.medicines_prescribed = String(updates.medicines_prescribed).trim() || null
  if (updates.notes != null) updates.notes = String(updates.notes).trim() || null
  db.update(prescriptions).set(updates as Record<string, string | number | null>).where(eq(prescriptions.id, id)).run()
}

/**
 * Soft-delete a prescription. Returns the image_path so caller can remove file from disk.
 */
export function remove(id: number): { image_path: string | null } {
  const db = getDb()
  const row = db.select({ image_path: prescriptions.image_path }).from(prescriptions).where(eq(prescriptions.id, id)).limit(1).all()[0]
  db.update(prescriptions).set({ is_deleted: true }).where(eq(prescriptions.id, id)).run()
  return { image_path: (row as { image_path?: string | null })?.image_path ?? null }
}
