import { eq, desc } from 'drizzle-orm'
import { getDb } from '../init'
import { users } from '../schema'
import type { UserRole } from './auth'
import * as auth from './auth'

export interface UserListRow {
  id: number
  full_name: string
  username: string
  role: UserRole
  is_active: boolean
  last_login: string | null
  created_at: string
}

/**
 * Get all users for admin list (includes inactive). Does not return password_hash.
 */
export function getAll(): UserListRow[] {
  const db = getDb()
  const rows = db
    .select({
      id: users.id,
      full_name: users.full_name,
      username: users.username,
      role: users.role,
      is_active: users.is_active,
      last_login: users.last_login,
      created_at: users.created_at
    })
    .from(users)
    .orderBy(desc(users.created_at))
    .all() as Array<{
    id: number
    full_name: string
    username: string
    role: string
    is_active: number | boolean
    last_login: string | null
    created_at: string
  }>
  return rows.map((r) => ({
    ...r,
    is_active: Boolean(r.is_active)
  }))
}

/**
 * Count admins that are active.
 */
export function countActiveAdmins(): number {
  const db = getDb()
  const all = db
    .select({ is_active: users.is_active })
    .from(users)
    .where(eq(users.role, 'admin'))
    .all() as Array<{ is_active: number | boolean }>
  return all.filter((u) => u.is_active === true || u.is_active === 1).length
}

/**
 * Create a new user. Password must be already hashed.
 */
export async function createUser(params: {
  full_name: string
  username: string
  passwordHash: string
  role: UserRole
}): Promise<{ id: number }> {
  return auth.createUser({
    fullName: params.full_name,
    username: params.username,
    passwordHash: params.passwordHash,
    role: params.role
  })
}

/**
 * Update user role and/or is_active.
 */
export function updateUser(id: number, data: { role?: UserRole; is_active?: boolean }): void {
  const db = getDb()
  const updates: { role?: string; is_active?: number } = {}
  if (data.role !== undefined) updates.role = data.role
  if (data.is_active !== undefined) updates.is_active = data.is_active ? 1 : 0
  if (Object.keys(updates).length === 0) return
  db.update(users).set(updates as never).where(eq(users.id, id)).run()
}

/**
 * Set password for a user (admin reset). Password must be already hashed.
 */
export function resetPassword(userId: number, passwordHash: string): void {
  const db = getDb()
  db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, userId)).run()
}
