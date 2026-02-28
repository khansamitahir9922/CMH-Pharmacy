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
  const { isAuthenticated } = useAuthStore()

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
