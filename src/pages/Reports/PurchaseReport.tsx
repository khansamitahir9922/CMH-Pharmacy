import React, { useState, useEffect } from 'react'
import { Typography, DatePicker, Select, Table, Button, Skeleton } from 'antd'
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { formatCurrency } from '@/utils/expiryStatus'
import { exportToExcel, exportToPDF } from '@/utils/exportUtils'

interface PurchaseReportRow {
  id: number
  order_number: string
  supplier_name: string | null
  order_date: string
  items_count: number
  total_amount: number
  paid_amount: number
  balance: number
  status: string
}

export function PurchaseReport(): React.ReactElement {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ])
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PurchaseReportRow[]>([])
  const [totalOutstanding, setTotalOutstanding] = useState(0)

  useEffect(() => {
    window.api
      .invoke<{ id: number; name: string }[]>('suppliers:getAll')
      .then((list) => setSuppliers(list ?? []))
      .catch(() => setSuppliers([]))
  }, [])

  const start = dateRange[0].format('YYYY-MM-DD')
  const end = dateRange[1].format('YYYY-MM-DD')

  const fetchReport = (): void => {
    setLoading(true)
    window.api
      .invoke<{ rows: PurchaseReportRow[]; totalOutstanding: number }>('reports:getPurchases', {
        startDate: start,
        endDate: end,
        supplierId: supplierId ?? undefined
      })
      .then((res) => {
        setRows(res?.rows ?? [])
        setTotalOutstanding(res?.totalOutstanding ?? 0)
      })
      .catch(() => {
        setRows([])
        setTotalOutstanding(0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReport()
  }, [start, end, supplierId])

  const columns: ColumnsType<PurchaseReportRow> = [
    { title: 'Order#', dataIndex: 'order_number', key: 'order_number', width: 120 },
    { title: 'Supplier', dataIndex: 'supplier_name', key: 'supplier_name', render: (v) => v ?? '—' },
    { title: 'Date', dataIndex: 'order_date', key: 'order_date', width: 110, render: (v) => (v ? String(v).slice(0, 10) : '—') },
    { title: 'Items', dataIndex: 'items_count', key: 'items_count', width: 80, align: 'right' },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', width: 110, align: 'right', render: (v) => formatCurrency(v ?? 0) },
    { title: 'Paid', dataIndex: 'paid_amount', key: 'paid_amount', width: 110, align: 'right', render: (v) => formatCurrency(v ?? 0) },
    { title: 'Balance', dataIndex: 'balance', key: 'balance', width: 110, align: 'right', render: (v) => formatCurrency(v ?? 0) },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100 }
  ]

  const handleExportExcel = (): void => {
    const data = rows.map((r) => ({
      'Order#': r.order_number,
      Supplier: r.supplier_name ?? '',
      Date: r.order_date,
      Items: r.items_count,
      Total: r.total_amount,
      Paid: r.paid_amount,
      Balance: r.balance,
      Status: r.status
    }))
    exportToExcel(
      data,
      ['Order#', 'Supplier', 'Date', 'Items', 'Total', 'Paid', 'Balance', 'Status'],
      `purchase-report-${start}-${end}.xlsx`
    )
  }

  const handleExportPdf = (): void => {
    const data = rows.map((r) => ({
      'Order#': r.order_number,
      Supplier: r.supplier_name ?? '',
      Date: r.order_date,
      Items: r.items_count,
      Total: r.total_amount,
      Paid: r.paid_amount,
      Balance: r.balance,
      Status: r.status
    }))
    exportToPDF(
      data,
      ['Order#', 'Supplier', 'Date', 'Items', 'Total', 'Paid', 'Balance', 'Status'],
      `Purchase Report (${start} to ${end})`,
      `purchase-report-${start}-${end}.pdf`
    )
  }

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        Purchase & Supply Report
      </Typography.Title>

      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <DatePicker.RangePicker value={dateRange} onChange={(v) => v && setDateRange(v as [Dayjs, Dayjs])} />
        <Select
          placeholder="All suppliers"
          allowClear
          style={{ width: 220 }}
          value={supplierId ?? undefined}
          onChange={(v) => setSupplierId(v ?? null)}
          options={[
            { value: null, label: 'All suppliers' },
            ...suppliers.map((s) => ({ value: s.id, label: s.name }))
          ]}
        />
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
              Export to Excel
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>
              Export to PDF
            </Button>
          </div>

          <Table
            rowKey="id"
            dataSource={rows}
            columns={columns}
            pagination={{ pageSize: 20 }}
            size="small"
          />

          <div style={{ marginTop: 16, fontWeight: 600 }}>
            Total outstanding: {formatCurrency(totalOutstanding)}
          </div>
        </>
      )}
    </div>
  )
}
