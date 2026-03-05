import React, { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { ExpiryReport } from '@/pages/Inventory/ExpiryReport'

const REPORT_NAME = 'Near-expiry Alert Report'

/** Renders Expiry Report and logs "Near-expiry Alert Report" in audit. */
export function NearExpiryReport(): React.ReactElement {
  const { currentUser } = useAuthStore()

  useEffect(() => {
    window.api.invoke('audit:logReportView', { reportName: REPORT_NAME, userId: currentUser?.id }).catch(() => {})
  }, [])

  return <ExpiryReport />
}
