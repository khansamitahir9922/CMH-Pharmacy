import { ipcMain } from 'electron'
import {
  getAll,
  getById,
  create,
  update,
  remove,
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updateOrderStatus,
  recordPayment,
  markOrderReceived,
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type GetPurchaseOrdersFilters,
  type CreatePurchaseOrderInput
} from '../../src/db/queries/suppliers'

/** Register suppliers module IPC handlers */
export function registerSuppliersHandlers(): void {
  ipcMain.handle('suppliers:getAll', async (_event, search?: string) => {
    return getAll(search ?? '')
  })

  ipcMain.handle('suppliers:getById', async (_event, id: number) => {
    if (id == null || typeof id !== 'number') return null
    return getById(id)
  })

  ipcMain.handle('suppliers:create', async (_event, data: CreateSupplierInput) => {
    if (!data?.name?.trim()) throw new Error('Supplier name is required.')
    if (!data?.contact_person?.trim()) throw new Error('Contact person is required.')
    if (!data?.phone?.trim()) throw new Error('Phone is required.')
    return create(data)
  })

  ipcMain.handle('suppliers:update', async (_event, data: UpdateSupplierInput) => {
    if (!data?.id) throw new Error('Supplier ID is required.')
    update(data)
    return getById(data.id)
  })

  ipcMain.handle('suppliers:delete', async (_event, id: number) => {
    if (id == null || typeof id !== 'number') throw new Error('Invalid supplier ID.')
    remove(id)
  })

  ipcMain.handle(
    'suppliers:getPurchaseOrders',
    async (_event, filters: GetPurchaseOrdersFilters): Promise<{ data: unknown[]; total: number }> => {
      return getPurchaseOrders(filters ?? {})
    }
  )

  ipcMain.handle('suppliers:getPurchaseOrderById', async (_event, orderId: number) => {
    if (orderId == null || typeof orderId !== 'number') return null
    return getPurchaseOrderById(orderId)
  })

  ipcMain.handle(
    'suppliers:createPurchaseOrder',
    async (_event, data: CreatePurchaseOrderInput): Promise<{ id: number; order_number: string }> => {
      if (!data?.supplier_id || !data?.order_date) throw new Error('Supplier and order date are required.')
      if (!data?.items?.length) throw new Error('Add at least one item to the order.')
      return createPurchaseOrder(data)
    }
  )

  ipcMain.handle('suppliers:updateOrderStatus', async (_event, orderId: number, status: string, receivedDate?: string | null) => {
    if (orderId == null || typeof orderId !== 'number') throw new Error('Invalid order ID.')
    updateOrderStatus(orderId, status as 'pending' | 'partial' | 'received' | 'cancelled', receivedDate)
  })

  ipcMain.handle('suppliers:recordPayment', async (_event, orderId: number, amountPaid: number) => {
    if (orderId == null || typeof orderId !== 'number') throw new Error('Invalid order ID.')
    if (amountPaid <= 0) throw new Error('Payment amount must be greater than 0.')
    recordPayment(orderId, amountPaid)
  })

  ipcMain.handle('suppliers:markOrderReceived', async (_event, orderId: number) => {
    if (orderId == null || typeof orderId !== 'number') throw new Error('Invalid order ID.')
    markOrderReceived(orderId)
  })
}
