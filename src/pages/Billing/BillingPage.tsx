import React from 'react'
import { Navigate } from 'react-router-dom'

export function BillingPage(): React.ReactElement {
  return <Navigate to="/billing/pos" replace />
}
