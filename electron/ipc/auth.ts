import { ipcMain } from 'electron'
import * as bcrypt from 'bcryptjs'
import {
  isUsersEmpty,
  createUser,
  findByUsername,
  updateLastLogin
} from '../../src/db/queries/auth'
import { log as auditLog } from '../../src/db/queries/audit'

/** Register authentication IPC handlers */
export function registerAuthHandlers(): void {
  ipcMain.handle('auth:checkFirstRun', async (): Promise<boolean> => {
    return isUsersEmpty()
  })

  ipcMain.handle(
    'auth:setup',
    async (
      _event,
      payload: { fullName: string; username: string; password: string }
    ): Promise<{ success: true } | { success: false; error: string }> => {
      try {
        if (!payload?.fullName?.trim() || !payload?.username?.trim() || !payload?.password) {
          return { success: false, error: 'Full name, username and password are required.' }
        }
        const existing = findByUsername(payload.username.trim())
        if (existing) {
          return { success: false, error: 'This username is already taken.' }
        }
        const saltRounds = 10
        const passwordHash = bcrypt.hashSync(payload.password, saltRounds)
        const { id: newUserId } = await createUser({
          fullName: payload.fullName.trim(),
          username: payload.username.trim(),
          passwordHash,
          role: 'admin'
        })
        auditLog({ user_id: newUserId, action: 'First-time setup', details: 'Administrator account created' })
        return { success: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Setup failed.'
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle(
    'auth:login',
    async (
      _event,
      payload: { username: string; password: string }
    ): Promise<{ id: number; username: string; full_name: string; role: string } | null> => {
      try {
        if (!payload?.username?.trim() || !payload?.password) {
          return null
        }
        const user = findByUsername(payload.username.trim())
        if (!user) return null
        const match = bcrypt.compareSync(payload.password, user.password_hash)
        if (!match) return null
        updateLastLogin(user.id)
        auditLog({ user_id: user.id, action: 'Login', details: user.username })
        return {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role
        }
      } catch {
        return null
      }
    }
  )

  ipcMain.handle('auth:logout', async (_event, payload?: { userId?: number }): Promise<void> => {
    if (payload?.userId != null) {
      auditLog({ user_id: payload.userId, action: 'Logout', details: null })
    }
  })
}
