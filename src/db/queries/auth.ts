import { eq } from 'drizzle-orm'
import { getDb } from '../init'
import { users } from '../schema'

export type UserRole = 'admin' | 'manager' | 'pharmacist' | 'dataentry'

export interface UserRow {
  id: number
  username: string
  full_name: string
  role: UserRole
  is_active: number
  last_login: string | null
}

/**
 * Returns true if the users table has no rows (first run).
 */
export function isUsersEmpty(): boolean {
  const db = getDb()
  const rows = db.select().from(users).limit(1).all()
  return rows.length === 0
}

/**
 * Inserts a new user with the given hashed password.
 */
export async function createUser(params: {
  fullName: string
  username: string
  passwordHash: string
  role: UserRole
}): Promise<{ id: number }> {
  const db = getDb()
  const rows = db
    .insert(users)
    .values({
      full_name: params.fullName,
      username: params.username,
      password_hash: params.passwordHash,
      role: params.role,
      is_active: true
    })
    .returning({ id: users.id })
    .all()
  const row = rows?.[0]
  if (!row) throw new Error('Failed to create user')
  return { id: row.id }
}

/**
 * Finds a user by username. Returns null if not found or inactive.
 */
export function findByUsername(username: string): {
  id: number
  username: string
  password_hash: string
  full_name: string
  role: UserRole
  is_active: number
} | null {
  const db = getDb()
  const rows = db
    .select({
      id: users.id,
      username: users.username,
      password_hash: users.password_hash,
      full_name: users.full_name,
      role: users.role,
      is_active: users.is_active
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
    .all()
  const row = rows[0]
  if (!row || !row.is_active) return null
  return { ...row, is_active: row.is_active ? 1 : 0 }
}

/**
 * Updates last_login to current UTC datetime for the given user id.
 */
export function updateLastLogin(userId: number): void {
  const db = getDb()
  db.update(users)
    .set({ last_login: new Date().toISOString() })
    .where(eq(users.id, userId))
}
