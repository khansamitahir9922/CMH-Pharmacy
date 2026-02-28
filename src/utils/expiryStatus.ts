import dayjs from 'dayjs'

export type ExpiryStatus = 'expired' | 'warning30' | 'warning90' | 'ok'

/**
 * Returns expiry status from an ISO or YYYY-MM-DD date string.
 */
export function getExpiryStatus(expiryDate: string | null | undefined): ExpiryStatus {
  if (!expiryDate) return 'ok'
  const exp = dayjs(expiryDate)
  const today = dayjs().startOf('day')
  if (exp.isBefore(today)) return 'expired'
  const daysLeft = exp.diff(today, 'day')
  if (daysLeft <= 30) return 'warning30'
  if (daysLeft <= 90) return 'warning90'
  return 'ok'
}

/**
 * Returns background and text color for expiry status (per .cursorrules).
 */
export function getExpiryColor(status: ExpiryStatus): { bg: string; text: string } {
  switch (status) {
    case 'expired':
      return { bg: '#FEF2F2', text: '#DC2626' }
    case 'warning30':
      return { bg: '#FFFBEB', text: '#D97706' }
    case 'warning90':
      return { bg: '#FEFCE8', text: '#CA8A04' }
    case 'ok':
      return { bg: '#ECFDF5', text: '#059669' }
    default:
      return { bg: '#ECFDF5', text: '#059669' }
  }
}

/**
 * Formats paisa (integer) as Pakistani Rupees. e.g. 12345 -> 'Rs. 123.45'
 */
export function formatCurrency(paisa: number): string {
  const amount = paisa / 100
  return `Rs. ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/**
 * Formats ISO or YYYY-MM-DD date string as DD/MM/YYYY.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = dayjs(dateStr)
  return d.isValid() ? d.format('DD/MM/YYYY') : '—'
}

/**
 * Returns days until expiry (negative if already expired).
 */
export function getDaysLeft(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null
  const exp = dayjs(expiryDate).startOf('day')
  const today = dayjs().startOf('day')
  return exp.diff(today, 'day')
}
