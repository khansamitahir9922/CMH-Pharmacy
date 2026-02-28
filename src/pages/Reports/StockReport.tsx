import React, { useState, useEffect } from 'react'
import { Typography, DatePicker, Select, Table, Card, Row, Col, Button, Skeleton } from 'antd'
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { formatCurrency } from '@/utils/expiryStatus'
import { exportToExcel, exportToPDF } from '@/utils/exportUtils'

interface StockBalanceSummary {
  totalSkus: number
  totalUnits: number
  totalStockValue: number
}

interface StockBalanceRow {
  medicine_id: number
  medicine_name: string
  category_name: string | null
  batch_no: string | null
  expiry_date: string | null
  opening: number
  issued: number
  received: number
  closing: number
}

export function StockReport(): React.ReactElement {
  const [asOfDate, setAsOfDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<StockBalanceSummary | null>(null)
  const [rows, setRows] = useState<StockBalanceRow[]>([])

  useEffect(() => {
    window.api
      .invoke<{ id: number; name: string }[]>('medicines:getCategories')
      .then((list) => setCategories(list ?? []))
      .catch(() => setCategories([]))
  }, [])

  const fetchReport = (): void => {
    setLoading(true)
    window.api
      .invoke<{ summary: StockBalanceSummary; rows: StockBalanceRow[] }>('reports:getStockBalance', {
        asOfDate,
        categoryId: categoryId ?? undefined
      })
      .then((res) => {
        setSummary(res?.summary ?? null)
        setRows(res?.rows ?? [])
      })
      .catch(() => {
        setSummary(null)
        setRows([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReport()
  }, [asOfDate, categoryId])

  const columns: ColumnsType<StockBalanceRow> = [
    { title: 'Medicine', dataIndex: 'medicine_name', key: 'medicine_name' },
    { title: 'Category', dataIndex: 'category_name', key: 'category_name', render: (v) => v ?? '—' },
    { title: 'Batch', dataIndex: 'batch_no', key: 'batch_no', render: (v) => v ?? '—' },
    { title: 'Expiry', dataIndex: 'expiry_date', key: 'expiry_date', width: 110, render: (v) => (v ? v.slice(0, 10) : '—') },
    { title: 'Opening', dataIndex: 'opening', key: 'opening', width: 90, align: 'right' },
    { title: 'Issued', dataIndex: 'issued', key: 'issued', width: 90, align: 'right' },
    { title: 'Received', dataIndex: 'received', key: 'received', width: 90, align: 'right' },
    { title: 'Closing Stock', dataIndex: 'closing', key: 'closing', width: 110, align: 'right' }
  ]

  const handleExportExcel = (): void => {
    const data = rows.map((r) => ({
      Medicine: r.medicine_name,
      Category: r.category_name ?? '',
      Batch: r.batch_no ?? '',
      Expiry: r.expiry_date ?? '',
      Opening: r.opening,
      Issued: r.issued,
      Received: r.received,
      'Closing Stock': r.closing
    }))
    exportToExcel(
      data,
      ['Medicine', 'Category', 'Batch', 'Expiry', 'Opening', 'Issued', 'Received', 'Closing Stock'],
      `stock-balance-${asOfDate}.xlsx`
    )
  }

  const handleExportPdf = (): void => {
    const data = rows.map((r) => ({
      Medicine: r.medicine_name,
      Category: r.category_name ?? '',
      Batch: r.batch_no ?? '',
      Expiry: r.expiry_date ?? '',
      Opening: r.opening,
      Issued: r.issued,
      Received: r.received,
      'Closing Stock': r.closing
    }))
    exportToPDF(
      data,
      ['Medicine', 'Category', 'Batch', 'Expiry', 'Opening', 'Issued', 'Received', 'Closing Stock'],
      `Stock Balance Report (as of ${asOfDate})`,
      `stock-balance-${asOfDate}.pdf`
    )
  }

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        Stock Balance Report
      </Typography.Title>

      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span>As of:</span>
        <DatePicker
          value={dayjs(asOfDate)}
          onChange={(d) => setAsOfDate(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
        />
        <span>Category:</span>
        <Select
          placeholder="All categories"
          allowClear
          style={{ width: 200 }}
          value={categoryId ?? undefined}
          onChange={(v) => setCategoryId(v ?? null)}
          options={[{ value: null, label: 'All' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card size="small" title="Total SKUs">
                <Typography.Title level={3} style={{ margin: 0 }}>{summary?.totalSkus ?? 0}</Typography.Title>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" title="Total Units in Stock">
                <Typography.Title level={3} style={{ margin: 0 }}>{summary?.totalUnits ?? 0}</Typography.Title>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" title="Total Stock Value (Sell Price)">
                <Typography.Title level={3} style={{ margin: 0 }}>{formatCurrency(summary?.totalStockValue ?? 0)}</Typography.Title>
              </Card>
            </Col>
          </Row>

          <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
              Export to Excel
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>
              Export to PDF
            </Button>
          </div>

          <Table
            rowKey="medicine_id"
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
