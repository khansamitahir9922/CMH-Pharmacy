import React, { useState, useEffect } from 'react'
import { Typography, Table, Button, Skeleton } from 'antd'
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { exportToExcel, exportToPDF } from '@/utils/exportUtils'

interface LowStockRow {
  id: number
  name: string
  category_name: string | null
  batch_no: string | null
  expiry_date: string | null
  current_quantity: number
  min_stock_level: number
}

export function LowStockReport(): React.ReactElement {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LowStockRow[]>([])

  const fetchReport = (): void => {
    setLoading(true)
    window.api
      .invoke<LowStockRow[]>('inventory:getLowStock', 1000)
      .then((res) => setRows(res ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReport()
  }, [])

  const columns: ColumnsType<LowStockRow> = [
    { title: 'Medicine', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category_name', key: 'category_name', render: (v) => v ?? '—' },
    { title: 'Batch', dataIndex: 'batch_no', key: 'batch_no', render: (v) => v ?? '—' },
    { title: 'Expiry', dataIndex: 'expiry_date', key: 'expiry_date', width: 110, render: (v) => (v ? String(v).slice(0, 10) : '—') },
    { title: 'Current Qty', dataIndex: 'current_quantity', key: 'current_quantity', width: 110, align: 'right' },
    { title: 'Min Stock', dataIndex: 'min_stock_level', key: 'min_stock_level', width: 110, align: 'right' }
  ]

  const handleExportExcel = (): void => {
    const data = rows.map((r) => ({
      Medicine: r.name,
      Category: r.category_name ?? '',
      Batch: r.batch_no ?? '',
      Expiry: r.expiry_date ?? '',
      'Current Qty': r.current_quantity,
      'Min Stock': r.min_stock_level
    }))
    exportToExcel(
      data,
      ['Medicine', 'Category', 'Batch', 'Expiry', 'Current Qty', 'Min Stock'],
      `low-stock-report-${new Date().toISOString().slice(0, 10)}.xlsx`
    )
  }

  const handleExportPdf = (): void => {
    const data = rows.map((r) => ({
      Medicine: r.name,
      Category: r.category_name ?? '',
      Batch: r.batch_no ?? '',
      Expiry: r.expiry_date ?? '',
      'Current Qty': r.current_quantity,
      'Min Stock': r.min_stock_level
    }))
    exportToPDF(
      data,
      ['Medicine', 'Category', 'Batch', 'Expiry', 'Current Qty', 'Min Stock'],
      'Low Stock Report',
      `low-stock-report-${new Date().toISOString().slice(0, 10)}.pdf`
    )
  }

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        Low Stock Report
      </Typography.Title>

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Medicines below minimum stock level. <a onClick={() => navigate('/inventory')}>Go to Inventory</a>
      </Typography.Text>

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
        </>
      )}
    </div>
  )
}
