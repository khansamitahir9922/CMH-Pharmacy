import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from '@/store/authStore'

interface AppGuardProps {
  children: React.ReactElement
}

/**
 * On app load: if first run (no users), redirect to /setup.
 * If not authenticated, redirect to /login.
 * Otherwise render children (protected app).
 */
export function AppGuard({ children }: AppGuardProps): React.ReactElement {
  const [checking, setChecking] = useState(true)
  const [isFirstRun, setIsFirstRun] = useState(false)
  const { isAuthenticated, currentUser, logout } = useAuthStore()

  useEffect(() => {
    let cancelled = false
    window.api
      .invoke<boolean>('auth:checkFirstRun')
      .then((firstRun) => {
        if (!cancelled) {
          setIsFirstRun(!!firstRun)
          setChecking(false)
        }
      })
      .catch(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Persisted login restores the UI, but Electron main only had a session after auth:login.
  // Sync so backup, user management, etc. work without forcing a re-login every launch.
  useEffect(() => {
    if (checking || isFirstRun || !isAuthenticated || currentUser?.id == null) return
    window.api
      .invoke<{ ok: boolean }>('auth:syncSession', { userId: currentUser.id })
      .then((res) => {
        if (res && !res.ok) logout()
      })
      .catch(() => {})
  }, [checking, isFirstRun, isAuthenticated, currentUser?.id, logout])

  if (checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F9FAFB'
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (isFirstRun) {
    return <Navigate to="/setup" replace />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
