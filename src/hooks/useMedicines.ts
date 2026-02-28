import { useState, useEffect, useCallback } from 'react'

export interface MedicineFilters {
  search?: string
  categoryId?: number | null
  expiryStatus?: 'all' | 'expired' | 'warning30' | 'warning90' | 'ok'
  stockStatus?: 'all' | 'low' | 'out'
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'expiry_date' | 'current_quantity'
  sortOrder?: 'asc' | 'desc'
}

export interface MedicineWithStock {
  id: number
  name: string
  category_id: number | null
  batch_no: string | null
  mfg_date: string | null
  expiry_date: string | null
  received_date: string | null
  order_date: string | null
  firm_name: string | null
  opening_stock: number
  unit_price_buy: number
  unit_price_sell: number
  min_stock_level: number
  shelf_location: string | null
  notes: string | null
  is_deleted: number
  created_at: string
  updated_at: string
  category_name: string | null
  current_quantity: number
}

const DEBOUNCE_MS = 300

/**
 * Fetches medicines list with filters. Debounces search by 300ms.
 */
export function useMedicines(filters: MedicineFilters): {
  medicines: MedicineWithStock[]
  total: number
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [medicines, setMedicines] = useState<MedicineWithStock[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search ?? '')

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(filters.search ?? '')
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [filters.search])

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(null)
    window.api
      .invoke<{ data: MedicineWithStock[]; total: number }>('medicines:getAll', {
        search: debouncedSearch,
        categoryId: filters.categoryId ?? null,
        expiryStatus: filters.expiryStatus ?? 'all',
        stockStatus: filters.stockStatus ?? 'all',
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 20,
        sortBy: filters.sortBy ?? 'name',
        sortOrder: filters.sortOrder ?? 'asc'
      })
      .then((res) => {
        setMedicines(res.data ?? [])
        setTotal(res.total ?? 0)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load medicines')
        setMedicines([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [
    debouncedSearch,
    filters.categoryId,
    filters.expiryStatus,
    filters.stockStatus,
    filters.page,
    filters.pageSize,
    filters.sortBy,
    filters.sortOrder
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { medicines, total, loading, error, refetch: fetchData }
}
