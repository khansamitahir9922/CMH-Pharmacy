import { ipcMain } from 'electron'
import * as bcrypt from 'bcryptjs'
import {
  isUsersEmpty,
  createUser,
  findByUsername,
  updateLastLogin
} from '../../src/db/queries/auth'

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
        await createUser({
          fullName: payload.fullName.trim(),
          username: payload.username.trim(),
          passwordHash,
          role: 'admin'
        })
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

  ipcMain.handle('auth:logout', async (): Promise<void> => {
    // No server-side session; client clears state
  })
}
