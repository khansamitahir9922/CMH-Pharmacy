import React, { useState, useEffect } from 'react'
import { Typography, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/utils/expiryStatus'

interface ControlledDrugRow {
  id: number
  name: string
  category_name: string | null
  batch_no: string | null
  current_quantity: number
  unit_price_sell: number
}

const REPORT_NAME = 'Controlled Drug Register Summary'

export function ControlledDrugRegisterReport(): React.ReactElement {
  const { currentUser } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ControlledDrugRow[]>([])

  useEffect(() => {
    window.api.invoke('audit:logReportView', { reportName: REPORT_NAME, userId: currentUser?.id }).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    window.api
      .invoke<ControlledDrugRow[]>('reports:getControlledDrugRegister')
      .then((res) => setRows(res ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const columns: ColumnsType<ControlledDrugRow> = [
    { title: 'Medicine', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category_name', key: 'category_name', render: (v) => v ?? '—' },
    { title: 'Batch', dataIndex: 'batch_no', key: 'batch_no', render: (v) => v ?? '—' },
    { title: 'Current Stock', dataIndex: 'current_quantity', key: 'current_quantity', width: 120, align: 'right' },
    { title: 'Unit Price (Sell)', dataIndex: 'unit_price_sell', key: 'unit_price_sell', width: 120, align: 'right', render: (v) => formatCurrency(v ?? 0) }
  ]

  return (
    <div>
      <Typography.Title level={4}>Controlled Drug Register Summary</Typography.Title>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Medicines marked as controlled. Mark a medicine as controlled in Medicines → Edit → Controlled drug.
      </p>
      <Table
        rowKey="id"
        dataSource={rows}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: 'No controlled drugs registered.' }}
      />
    </div>
  )
}
