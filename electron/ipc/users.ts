import { ipcMain } from 'electron'
import * as bcrypt from 'bcryptjs'
import {
  getAll,
  createUser,
  updateUser,
  resetPassword,
  countActiveAdmins,
  type UserListRow
} from '../../src/db/queries/users'
import { findByUsername } from '../../src/db/queries/auth'
import type { UserRole } from '../../src/db/queries/auth'

const SALT_ROUNDS = 10

export function registerUsersHandlers(): void {
  ipcMain.handle('users:getAll', async (): Promise<UserListRow[]> => {
    return getAll()
  })

  ipcMain.handle(
    'users:create',
    async (
      _event,
      payload: { full_name: string; username: string; password: string; role: UserRole }
    ): Promise<{ success: true; id: number } | { success: false; error: string }> => {
      try {
        if (!payload?.full_name?.trim() || !payload?.username?.trim() || !payload?.password) {
          return { success: false, error: 'Full name, username and password are required.' }
        }
        if (payload.password.length < 4) {
          return { success: false, error: 'Password must be at least 4 characters.' }
        }
        const existing = findByUsername(payload.username.trim())
        if (existing) {
          return { success: false, error: 'Username already taken.' }
        }
        const passwordHash = bcrypt.hashSync(payload.password, SALT_ROUNDS)
        const { id } = await createUser({
          full_name: payload.full_name.trim(),
          username: payload.username.trim(),
          passwordHash,
          role: payload.role ?? 'dataentry'
        })
        return { success: true, id }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create user.'
        return { success: false, error: msg }
      }
    }
  )

  ipcMain.handle(
    'users:update',
    async (
      _event,
      payload: { id: number; currentUserId: number; role?: UserRole; is_active?: boolean }
    ): Promise<{ success: true } | { success: false; error: string }> => {
      try {
        const { id, currentUserId, role, is_active } = payload ?? {}
        if (id == null) return { success: false, error: 'User ID is required.' }
        if (id === currentUserId && is_active === false) {
          return { success: false, error: 'You cannot deactivate your own account.' }
        }
        if (is_active === false) {
          const admins = countActiveAdmins()
          const targetUser = getAll().find((u) => u.id === id)
          if (targetUser?.role === 'admin' && admins <= 1) {
            return { success: false, error: 'Cannot deactivate the only admin.' }
          }
        }
        updateUser(id, { role, is_active })
        return { success: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Update failed.'
        return { success: false, error: msg }
      }
    }
  )

  ipcMain.handle(
    'users:resetPassword',
    async (
      _event,
      payload: { userId: number; newPassword: string }
    ): Promise<{ success: true } | { success: false; error: string }> => {
      try {
        const { userId, newPassword } = payload ?? {}
        if (userId == null || !newPassword || newPassword.length < 4) {
          return { success: false, error: 'User ID and new password (min 4 characters) are required.' }
        }
        const hash = bcrypt.hashSync(newPassword, SALT_ROUNDS)
        resetPassword(userId, hash)
        return { success: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Password reset failed.'
        return { success: false, error: msg }
      }
    }
  )
}
