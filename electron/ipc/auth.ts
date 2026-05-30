import { ipcMain } from 'electron'
import * as bcrypt from 'bcryptjs'
import {
  isUsersEmpty,
  createUser,
  findByUsername,
  findActiveUserById,
  updateLastLogin
} from '../../src/db/queries/auth'
import { log as auditLog } from '../../src/db/queries/audit'

let currentSession: { userId: number; role: string } | null = null

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_MS = 5 * 60 * 1000
const WINDOW_MS = 60 * 1000
const loginAttempts = new Map<string, { count: number; firstAt: number }>()

function checkLoginRateLimit(username: string): boolean {
  const key = username.toLowerCase().trim()
  const now = Date.now()
  const entry = loginAttempts.get(key)
  if (!entry) return true
  if (now - entry.firstAt > WINDOW_MS) {
    loginAttempts.delete(key)
    return true
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    if (now - entry.firstAt < LOCKOUT_MS) return false
    loginAttempts.delete(key)
    return true
  }
  return true
}

function recordLoginAttempt(username: string, success: boolean): void {
  const key = username.toLowerCase().trim()
  const now = Date.now()
  if (success) {
    loginAttempts.delete(key)
    return
  }
  const entry = loginAttempts.get(key) ?? { count: 0, firstAt: now }
  if (now - entry.firstAt > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAt: now })
  } else {
    entry.count++
  }
}

export function getSession(): { userId: number; role: string } | null {
  return currentSession
}

export function requireSession(): void {
  if (!currentSession) throw new Error('Not authenticated.')
}

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
        const username = payload.username.trim()
        if (!checkLoginRateLimit(username)) {
          return null
        }
        const user = findByUsername(username)
        if (!user) {
          recordLoginAttempt(username, false)
          return null
        }
        const match = bcrypt.compareSync(payload.password, user.password_hash)
        if (!match) {
          recordLoginAttempt(username, false)
          return null
        }
        recordLoginAttempt(username, true)
        updateLastLogin(user.id)
        auditLog({ user_id: user.id, action: 'Login', details: user.username })
        currentSession = { userId: user.id, role: user.role }
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

  /**
   * Restores main-process session when the renderer rehydrates persisted login (no password).
   * Without this, IPC handlers that call requireSession() fail until the user signs in again.
   */
  ipcMain.handle(
    'auth:syncSession',
    async (_event, payload: { userId: number }): Promise<{ ok: boolean }> => {
      try {
        const uid = payload?.userId
        if (uid == null || typeof uid !== 'number') {
          currentSession = null
          return { ok: false }
        }
        const user = findActiveUserById(uid)
        if (!user) {
          currentSession = null
          return { ok: false }
        }
        currentSession = { userId: user.id, role: user.role }
        return { ok: true }
      } catch {
        currentSession = null
        return { ok: false }
      }
    }
  )

  ipcMain.handle('auth:logout', async (_event, payload?: { userId?: number }): Promise<void> => {
    currentSession = null
    if (payload?.userId != null) {
      auditLog({ user_id: payload.userId, action: 'Logout', details: null })
    }
  })
}
