import React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Result, Button } from 'antd'
import { useAuthStore } from '@/store/authStore'

interface ProtectedRouteProps {
  children: React.ReactElement
  allowedRoles?: string[]
}

/**
 * Wraps routes that require authentication.
 * Redirects to /login if not authenticated.
 * If allowedRoles is provided and user's role is not in the list, shows Access Denied.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps): React.ReactElement {
  const navigate = useNavigate()
  const { isAuthenticated, currentUser } = useAuthStore()

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    return (
      <Result
        status="403"
        title="Access Denied"
        subTitle="You do not have permission to view this page."
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        }
      />
    )
  }

  return children
}
