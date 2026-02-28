import React, { useState, useEffect } from 'react'
import {
  Typography,
  Button,
  Select,
  DatePicker,
  Table,
  Space,
  Modal,
  message,
  notification,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  EyeOutlined,
  PrinterOutlined,
  CheckOutlined,
  DollarOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { formatCurrency, formatDate } from '@/utils/expiryStatus'
import { useSearchParams } from 'react-router-dom'
import { PurchaseOrderModal } from './PurchaseOrderModal'
import { RecordPaymentModal } from './RecordPaymentModal'

type OrderStatus = 'pending' | 'partial' | 'received' | 'cancelled'

interface OrderRow {
  id: number
  order_number: string
  supplier_id: number | null
  supplier_name: string | null
  order_date: string
  expected_date: string | null
  received_date: string | null
  status: OrderStatus
  total_amount: number
  paid_amount: number
  items_count: number
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' }
]

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: '#CA8A04',
  partial: '#D97706',
  received: '#059669',
  cancelled: '#DC2626'
}

export function PurchaseOrdersPage(): React.ReactElement {
  const [searchParams] = useSearchParams()
  const supplierIdFromUrl = searchParams.get('supplierId')
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filterSupplierId, setFilterSupplierId] = useState<number | null>(
    supplierIdFromUrl ? parseInt(supplierIdFromUrl, 10) : null
  )
  const [filterStatus, setFilterStatus] = useState<OrderStatus | null>(null)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [viewOrderId, setViewOrderId] = useState<number | null>(null)
  const [paymentOrderId, setPaymentOrderId] = useState<number | null>(null)
  const [printOrderId, setPrintOrderId] = useState<number | null>(null)

  useEffect(() => {
    window.api.invoke<{ id: number; name: string }[]>('suppliers:getAll').then((list) => {
      setSuppliers(list ?? [])
    })
  }, [])

  const fetchOrders = (): void => {
    setLoading(true)
    const startDate = dateRange?.[0]?.format('YYYY-MM-DD') ?? null
    const endDate = dateRange?.[1]?.format('YYYY-MM-DD') ?? null
    window.api
      .invoke<{ data: OrderRow[]; total: number }>('suppliers:getPurchaseOrders', {
        supplierId: filterSupplierId ?? undefined,
        status: filterStatus ?? undefined,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
        page,
        pageSize
      })
      .then((res) => {
        setOrders(res.data ?? [])
        setTotal(res.total ?? 0)
      })
      .catch(() => {
        setOrders([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchOrders()
  }, [page, pageSize, filterSupplierId, filterStatus, dateRange])

  const handleMarkReceived = (orderId: number): void => {
    Modal.confirm({
      title: 'Mark order as received?',
      content: 'This will update stock for all items in this order.',
      okText: 'Mark Received',
      onOk: async () => {
        try {
          await window.api.invoke('suppliers:markOrderReceived', orderId)
          notification.success({ message: 'Order marked as received. Stock updated.' })
          fetchOrders()
        } catch (err) {
          notification.error({
            message: 'Failed',
            description: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }
    })
  }

  const handleCancelOrder = (record: OrderRow): void => {
    Modal.confirm({
      title: 'Cancel this order?',
      content: `Order ${record.order_number} will be marked as cancelled. You cannot receive stock or record payment for a cancelled order.`,
      okText: 'Cancel order',
      okType: 'danger',
      cancelText: 'Keep order',
      onOk: async () => {
        try {
          await window.api.invoke('suppliers:updateOrderStatus', record.id, 'cancelled')
          notification.success({ message: 'Order cancelled.' })
          fetchOrders()
        } catch (err) {
          notification.error({
            message: 'Failed to cancel',
            description: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }
    })
  }

  const columns: ColumnsType<OrderRow> = [
    { title: 'Order#', dataIndex: 'order_number', key: 'order_number', width: 88, ellipsis: true },
    { title: 'Supplier', dataIndex: 'supplier_name', key: 'supplier_name', width: 90, ellipsis: true, render: (v) => v ?? '—' },
    {
      title: 'Order Date',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 94,
      render: (v) => formatDate(v)
    },
    { title: 'Items', dataIndex: 'items_count', key: 'items_count', width: 54 },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 88,
      render: (v) => formatCurrency(v ?? 0)
    },
    {
      title: 'Paid',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 88,
      render: (v) => formatCurrency(v ?? 0)
    },
    {
      title: 'Balance',
      key: 'balance',
      width: 88,
      render: (_, r) => formatCurrency((r.total_amount ?? 0) - (r.paid_amount ?? 0))
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 86,
      render: (status: OrderStatus) => (
        <span
          style={{
            padding: '2px 6px',
            borderRadius: 4,
            backgroundColor: STATUS_COLOR[status] + '20',
            color: STATUS_COLOR[status],
            fontWeight: 500,
            whiteSpace: 'nowrap'
          }}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 132,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4} wrap={false}>
          <Tooltip title="View">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewOrderId(record.id)} />
          </Tooltip>
          <Tooltip title="Print">
            <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => setPrintOrderId(record.id)} />
          </Tooltip>
          {record.status !== 'received' && record.status !== 'cancelled' && (
            <Tooltip title="Mark Received">
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleMarkReceived(record.id)} />
            </Tooltip>
          )}
          {(record.status === 'pending' || record.status === 'partial') && (
            <Tooltip title="Record Payment">
              <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => setPaymentOrderId(record.id)} />
            </Tooltip>
          )}
          {(record.status === 'pending' || record.status === 'partial') && (
            <Tooltip title="Cancel order">
              <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleCancelOrder(record)} />
            </Tooltip>
          )}
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Purchase Orders
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewOrderOpen(true)}>
          New Order
        </Button>
      </div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="Supplier"
          allowClear
          style={{ width: 200 }}
          value={filterSupplierId !== null ? filterSupplierId : 'all'}
          onChange={(v) => { setFilterSupplierId(v === 'all' || v == null ? null : (v as number)); setPage(1) }}
          options={[{ value: 'all', label: 'All Suppliers' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
        />
        <Select
          placeholder="Status"
          allowClear
          style={{ width: 130 }}
          value={filterStatus ?? undefined}
          onChange={(v) => { setFilterStatus(v ?? null); setPage(1) }}
          options={STATUS_OPTIONS}
        />
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(dates) => { setDateRange(dates as [Dayjs, Dayjs] | null); setPage(1) }}
          format="DD/MM/YYYY"
        />
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={orders}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (t) => `Total ${t} orders`
        }}
        onChange={(p) => {
          if (p.current) setPage(p.current)
          if (p.pageSize) setPageSize(p.pageSize)
        }}
        scroll={{ x: 808 }}
      />
      <PurchaseOrderModal open={newOrderOpen} onClose={() => setNewOrderOpen(false)} onSuccess={() => { setNewOrderOpen(false); fetchOrders() }} />
      {viewOrderId != null && (
        <ViewOrderModal
          orderId={viewOrderId}
          onClose={() => setViewOrderId(null)}
        />
      )}
      {paymentOrderId != null && (
        <RecordPaymentModal
          orderId={paymentOrderId}
          onClose={() => setPaymentOrderId(null)}
          onSuccess={() => { setPaymentOrderId(null); fetchOrders() }}
        />
      )}
      {printOrderId != null && (
        <PrintOrder orderId={printOrderId} onClose={() => setPrintOrderId(null)} />
      )}
    </div>
  )
}

/** Simple view order modal (detail only). */
function ViewOrderModal({ orderId, onClose }: { orderId: number; onClose: () => void }): React.ReactElement {
  const [data, setData] = useState<{
    order: OrderRow & { supplier_name: string | null }
    items: { medicine_name: string | null; quantity_ordered: number; unit_price: number }[]
  } | null>(null)
  useEffect(() => {
    window.api.invoke<typeof data>('suppliers:getPurchaseOrderById', orderId).then(setData)
  }, [orderId])
  const order = data?.order
  const items = data?.items ?? []
  return (
    <Modal title={order ? `Order ${order.order_number}` : 'Order'} open onCancel={onClose} footer={null} width={640}>
      {order && (
        <div>
          <p><strong>Supplier:</strong> {order.supplier_name ?? '—'}</p>
          <p><strong>Order Date:</strong> {formatDate(order.order_date)}</p>
          <p><strong>Total:</strong> {formatCurrency(order.total_amount)} | <strong>Paid:</strong> {formatCurrency(order.paid_amount)}</p>
          <Table
            size="small"
            dataSource={items}
            rowKey={(_, i) => String(i)}
            columns={[
              { title: 'Medicine', dataIndex: 'medicine_name', key: 'medicine_name', render: (v) => v ?? '—' },
              { title: 'Qty', dataIndex: 'quantity_ordered', key: 'quantity_ordered', width: 80 },
              { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', render: (v) => formatCurrency(v) }
            ]}
            pagination={false}
          />
        </div>
      )}
    </Modal>
  )
}

/** Print purchase order: open printable window and call window.print(). */
function PrintOrder({ orderId, onClose }: { orderId: number; onClose: () => void }): React.ReactElement {
  const [html, setHtml] = useState<string>('')
  useEffect(() => {
    window.api.invoke<{ order: OrderRow & { supplier_name: string | null }; items: { medicine_name: string | null; quantity_ordered: number; unit_price: number }[] } | null>('suppliers:getPurchaseOrderById', orderId).then((d) => {
      if (!d) return
      const o = d.order
      const rows = d.items.map((i, idx) => `<tr><td>${idx + 1}</td><td>${i.medicine_name ?? ''}</td><td>${i.quantity_ordered}</td><td>${formatCurrency(i.unit_price)}</td><td>${formatCurrency(i.quantity_ordered * i.unit_price)}</td></tr>`).join('')
      setHtml(`
        <!DOCTYPE html><html><head><title>PO ${o.order_number}</title>
        <style>body{font-family:system-ui;padding:24px;max-width:800px;margin:0 auto} table{border-collapse:collapse;width:100%;margin-top:16px} th,td{border:1px solid #ddd;padding:8px;text-align:left} @media print{body{padding:0}.no-print{display:none}}</style></head><body>
        <h1>SKBZ/CMH RAWALAKOT PHARMACY</h1>
        <p>Purchase Order: <strong>${o.order_number}</strong> &nbsp; Date: ${formatDate(o.order_date)}</p>
        <p>Supplier: <strong>${o.supplier_name ?? '—'}</strong></p>
        <table><thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
        <p style="margin-top:24px"><strong>Grand Total: ${formatCurrency(o.total_amount)}</strong></p>
        <p style="margin-top:32px">Signature: _________________________</p>
        </body></html>
      `)
    })
  }, [orderId])
  useEffect(() => {
    if (!html) return
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.focus()
      setTimeout(() => { w.print(); w.close() }, 250)
    }
    onClose()
  }, [html, onClose])
  return <></>
}
