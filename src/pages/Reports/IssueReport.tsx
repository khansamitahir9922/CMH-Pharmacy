import React, { useState, useEffect } from 'react'
import { Typography, DatePicker, Select, Table, Button, Skeleton } from 'antd'
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { exportToExcel, exportToPDF } from '@/utils/exportUtils'

interface MedicineIssueRow {
  date: string
  medicine_name: string | null
  quantity: number
  type: string
  reason: string | null
  reference: string | null
}

export function IssueReport(): React.ReactElement {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ])
  const [medicineId, setMedicineId] = useState<number | null>(null)
  const [medicines, setMedicines] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<MedicineIssueRow[]>([])

  useEffect(() => {
    window.api
      .invoke<{ data: { id: number; name: string }[]; total: number }>('medicines:getAll', { page: 1, pageSize: 500 })
      .then((res) => setMedicines(res?.data ?? []))
      .catch(() => setMedicines([]))
  }, [])

  const start = dateRange[0].format('YYYY-MM-DD')
  const end = dateRange[1].format('YYYY-MM-DD')

  const fetchReport = (): void => {
    setLoading(true)
    window.api
      .invoke<MedicineIssueRow[]>('reports:getMedicineIssues', {
        startDate: start,
        endDate: end,
        medicineId: medicineId ?? undefined
      })
      .then((res) => setRows(res ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReport()
  }, [start, end, medicineId])

  const columns: ColumnsType<MedicineIssueRow> = [
    { title: 'Date', dataIndex: 'date', key: 'date', width: 110 },
    { title: 'Medicine', dataIndex: 'medicine_name', key: 'medicine_name', render: (v) => v ?? '—' },
    { title: 'Qty Issued', dataIndex: 'quantity', key: 'quantity', width: 100, align: 'right' },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 90 },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', render: (v) => v ?? '—' },
    { title: 'Reference', dataIndex: 'reference', key: 'reference', render: (v) => v ?? '—' }
  ]

  const handleExportExcel = (): void => {
    const data = rows.map((r) => ({
      Date: r.date,
      Medicine: r.medicine_name ?? '',
      'Qty Issued': r.quantity,
      Type: r.type,
      Reason: r.reason ?? '',
      Reference: r.reference ?? ''
    }))
    exportToExcel(
      data,
      ['Date', 'Medicine', 'Qty Issued', 'Type', 'Reason', 'Reference'],
      `medicine-issue-report-${start}-${end}.xlsx`
    )
  }

  const handleExportPdf = (): void => {
    const data = rows.map((r) => ({
      Date: r.date,
      Medicine: r.medicine_name ?? '',
      'Qty Issued': r.quantity,
      Type: r.type,
      Reason: r.reason ?? '',
      Reference: r.reference ?? ''
    }))
    exportToPDF(
      data,
      ['Date', 'Medicine', 'Qty Issued', 'Type', 'Reason', 'Reference'],
      `Medicine Issue Report (${start} to ${end})`,
      `medicine-issue-report-${start}-${end}.pdf`
    )
  }

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        Medicine Issue Report
      </Typography.Title>

      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(v) => v && setDateRange(v as [Dayjs, Dayjs])}
        />
        <Select
          placeholder="All medicines"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 280 }}
          value={medicineId ?? undefined}
          onChange={(v) => setMedicineId(v ?? null)}
          options={[
            { value: null, label: 'All medicines' },
            ...medicines.map((m) => ({ value: m.id, label: m.name }))
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
            rowKey={(_, i) => String(i)}
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
