import React, { useState, useEffect, useMemo } from 'react'
import {
  Typography,
  Card,
  Form,
  Select,
  Radio,
  InputNumber,
  Input,
  DatePicker,
  Button,
  Table,
  Space,
  message,
  notification
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/utils/expiryStatus'

interface MedicineOption {
  id: number
  name: string
  batch_no: string | null
  current_quantity: number
}

interface TransactionRow {
  id: number
  medicine_id: number
  transaction_type: 'in' | 'out' | 'adjust'
  quantity: number
  reason: string | null
  created_at: string
  performed_by: number | null
  medicine_name: string | null
  batch_no: string | null
  performer_name: string | null
}

const TYPE_OPTIONS = [
  { value: 'in', label: 'Stock In' },
  { value: 'out', label: 'Stock Out' },
  { value: 'adjust', label: 'Adjustment' }
]

export function StockTransactions(): React.ReactElement {
  const { currentUser } = useAuthStore()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [medicineOptions, setMedicineOptions] = useState<MedicineOption[]>([])
  const [filterMedicineId, setFilterMedicineId] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(() => {
    const end = dayjs()
    const start = end.subtract(6, 'day')
    return [start, end]
  })

  const startDate = dateRange?.[0]?.format('YYYY-MM-DD') ?? null
  const endDate = dateRange?.[1]?.format('YYYY-MM-DD') ?? null

  const fetchTransactions = (): void => {
    setLoading(true)
    window.api
      .invoke<{ data: TransactionRow[]; total: number }>('inventory:getTransactions', {
        medicineId: filterMedicineId ?? undefined,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
        page,
        pageSize
      })
      .then((res) => {
        setTransactions(res.data ?? [])
        setTotal(res.total ?? 0)
      })
      .catch(() => {
        setTransactions([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTransactions()
  }, [page, pageSize, filterMedicineId, startDate, endDate])

  const onFinish = async (values: {
    medicineId: number
    type: 'in' | 'out' | 'adjust'
    quantity: number
    reason: string
    date: Dayjs
    notes?: string
  }): Promise<void> => {
    setSubmitting(true)
    try {
      await window.api.invoke('inventory:recordTransaction', {
        medicineId: values.medicineId,
        type: values.type,
        quantity: values.quantity,
        reason: values.reason.trim(),
        date: values.date.format('YYYY-MM-DD'),
        notes: values.notes?.trim() ?? null,
        performedBy: currentUser?.id ?? null
      })
      notification.success({ message: 'Transaction recorded successfully.' })
      form.resetFields()
      form.setFieldValue('date', dayjs())
      fetchTransactions()
    } catch (err) {
      notification.error({
        message: 'Failed to record transaction',
        description: err instanceof Error ? err.message : 'Unknown error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const loadMedicineOptions = (search: string): void => {
    if (!search.trim()) {
      setMedicineOptions([])
      return
    }
    window.api.invoke<MedicineOption[]>('medicines:search', search).then((list) => {
      setMedicineOptions(list ?? [])
    })
  }

  const debouncedSearch = useMemo(() => {
    let t: ReturnType<typeof setTimeout>
    return (v: string) => {
      clearTimeout(t)
      t = setTimeout(() => loadMedicineOptions(v), 300)
    }
  }, [])

  const columns: ColumnsType<TransactionRow> = [
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (v: string) => formatDate(v?.slice(0, 10))
    },
    {
      title: 'Medicine',
      key: 'medicine',
      render: (_, r) =>
        r.medicine_name
          ? r.medicine_name + (r.batch_no ? ' (' + r.batch_no + ')' : '')
          : '—'
    },
    {
      title: 'Type',
      dataIndex: 'transaction_type',
      key: 'transaction_type',
      width: 100,
      render: (type: string) => {
        const color = type === 'in' ? '#059669' : type === 'out' ? '#DC2626' : '#1A56DB'
        return (
          <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: color + '20', color, fontWeight: 500 }}>
            {type === 'in' ? 'In' : type === 'out' ? 'Out' : 'Adjust'}
          </span>
        )
      }
    },
    { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', width: 90 },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: 'Performed By', dataIndex: 'performer_name', key: 'performer_name', width: 120, render: (v) => v ?? '—' }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        Stock Transactions
      </Typography.Title>

      <Card title="Record Transaction" size="small" style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ type: 'in', date: dayjs() }}
        >
          <Form.Item
            name="medicineId"
            label="Medicine"
            rules={[{ required: true, message: 'Select a medicine.' }]}
          >
            <Select
              showSearch
              placeholder="Search medicine by name or batch"
              filterOption={false}
              onSearch={debouncedSearch}
              onFocus={() => loadMedicineOptions(form.getFieldValue('medicineId') ? '' : ' ')}
              optionLabelProp="label"
              options={medicineOptions.map((m) => ({
                value: m.id,
                label: m.name + (m.batch_no ? ' (' + m.batch_no + ')' : '') + ' — Stock: ' + m.current_quantity
              }))}
            />
          </Form.Item>
          <Form.Item name="type" label="Transaction Type" rules={[{ required: true }]}>
            <Radio.Group options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="Quantity"
            rules={[
              { required: true, message: 'Enter quantity.' },
              { type: 'number', min: 1, message: 'Quantity must be greater than 0.' }
            ]}
          >
            <InputNumber min={1} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Enter reason.' }]}>
            <Input placeholder="Reason for transaction" />
          </Form.Item>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Record Transaction
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Transaction History" size="small">
        <Space style={{ marginBottom: 16 }} wrap>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
            format="DD/MM/YYYY"
          />
          <Select
            placeholder="Filter by medicine"
            allowClear
            style={{ width: 220 }}
            value={filterMedicineId ?? undefined}
            onChange={(v) => { setFilterMedicineId(v ?? null); setPage(1) }}
            onSearch={debouncedSearch}
            filterOption={false}
            onFocus={() => loadMedicineOptions(' ')}
            options={medicineOptions.map((m) => ({ value: m.id, label: m.name + ' (' + (m.batch_no ?? '-') + ')' }))}
          />
        </Space>
        <Table
          rowKey="id"
          dataSource={transactions}
          columns={columns}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => 'Total ' + t + ' transactions'
          }}
          onChange={(pagination) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
          }}
        />
      </Card>
    </div>
  )
}
