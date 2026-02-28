import React, { useState, useEffect } from 'react'
import {
  Typography,
  Button,
  Input,
  Select,
  Table,
  Space,
  Skeleton,
  Empty,
  Modal,
  message
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, BarcodeOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import * as XLSX from 'xlsx'
import { useMedicines, type MedicineWithStock, type MedicineFilters } from '@/hooks/useMedicines'
import { MedicineFormModal } from './MedicineFormModal'
import { getExpiryStatus, getExpiryColor, formatCurrency, formatDate } from '@/utils/expiryStatus'

const EXPIRY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'expired', label: 'Expired' },
  { value: 'warning30', label: 'Expiring in 30 Days' },
  { value: 'warning90', label: 'Expiring in 90 Days' },
  { value: 'ok', label: 'OK' }
]

const STOCK_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low Stock' },
  { value: 'out', label: 'Out of Stock' }
]

export function MedicineListPage(): React.ReactElement {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [expiryStatus, setExpiryStatus] = useState<MedicineFilters['expiryStatus']>('all')
  const [stockStatus, setStockStatus] = useState<MedicineFilters['stockStatus']>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sortBy, setSortBy] = useState<MedicineFilters['sortBy']>('name')
  const [sortOrder, setSortOrder] = useState<MedicineFilters['sortOrder']>('asc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [addWithBarcode, setAddWithBarcode] = useState<string | null>(null)
  const [barcodeScanInput, setBarcodeScanInput] = useState('')
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])

  const filters: MedicineFilters = {
    search,
    categoryId,
    expiryStatus,
    stockStatus,
    page,
    pageSize,
    sortBy,
    sortOrder
  }

  const { medicines, total, loading, error, refetch } = useMedicines(filters)

  useEffect(() => {
    window.api.invoke<{ id: number; name: string }[]>('medicines:getCategories').then((list) => {
      setCategories(list ?? [])
    })
  }, [])

  const handleResetFilters = (): void => {
    setSearch('')
    setCategoryId(null)
    setExpiryStatus('all')
    setStockStatus('all')
    setPage(1)
  }

  const handleAdd = (): void => {
    setEditId(null)
    setModalOpen(true)
  }

  const handleEdit = (id: number): void => {
    setEditId(id)
    setModalOpen(true)
  }

  const handleDelete = (record: MedicineWithStock): void => {
    Modal.confirm({
      title: 'Delete medicine?',
      content: `Are you sure you want to delete "${record.name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await window.api.invoke('medicines:delete', record.id)
          message.success('Medicine deleted.')
          refetch()
        } catch (err) {
          message.error(err instanceof Error ? err.message : 'Failed to delete.')
        }
      }
    })
  }

  const handleExport = async (): Promise<void> => {
    try {
      const data = await window.api.invoke<MedicineWithStock[]>('medicines:exportData')
      if (!data?.length) {
        message.info('No data to export.')
        return
      }
      const rows = data.map((m) => ({
        'Sr#': 0,
        'Medicine Name': m.name,
        Category: m.category_name ?? '',
        'Batch No': m.batch_no ?? '',
        'Expiry Date': m.expiry_date ? formatDate(m.expiry_date) : '',
        'Current Stock': m.current_quantity,
        'Min Stock': m.min_stock_level,
        'Sell Price': formatCurrency(m.unit_price_sell)
      }))
      rows.forEach((r, i) => (r['Sr#'] = i + 1))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Medicines')
      XLSX.writeFile(wb, `medicines-export-${new Date().toISOString().slice(0, 10)}.xlsx`)
      message.success('Export completed.')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Export failed.')
    }
  }

  const handleTableChange = (_pagination: unknown, _filters: unknown, sorter: unknown): void => {
    const s = sorter as { field?: string; order?: 'ascend' | 'descend' }
    if (s?.field && (s.field === 'name' || s.field === 'expiry_date' || s.field === 'current_quantity')) {
      setSortBy(
        s.field === 'name' ? 'name' : s.field === 'expiry_date' ? 'expiry_date' : 'current_quantity'
      )
      setSortOrder(s.order === 'descend' ? 'desc' : 'asc')
    }
  }

  const columns: ColumnsType<MedicineWithStock> = [
    {
      title: 'Sr#',
      key: 'sr',
      width: 64,
      render: (_: unknown, __: MedicineWithStock, index: number) => (page - 1) * pageSize + index + 1
    },
    {
      title: 'Medicine Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortOrder: sortBy === 'name' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : undefined
    },
    {
      title: 'Category',
      dataIndex: 'category_name',
      key: 'category_name',
      render: (v: string | null) => v ?? '—'
    },
    {
      title: 'Batch No',
      dataIndex: 'batch_no',
      key: 'batch_no',
      render: (v: string | null) => v ?? '—'
    },
    {
      title: 'Expiry Date',
      dataIndex: 'expiry_date',
      key: 'expiry_date',
      sorter: true,
      sortOrder: sortBy === 'expiry_date' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : undefined,
      render: (v: string | null, record: MedicineWithStock) => {
        const status = getExpiryStatus(v)
        const { bg, text } = getExpiryColor(status)
        return (
          <span style={{ padding: '2px 6px', borderRadius: 4, backgroundColor: bg, color: text }}>
            {formatDate(v)}
          </span>
        )
      }
    },
    {
      title: 'Current Stock',
      dataIndex: 'current_quantity',
      key: 'current_quantity',
      sorter: true,
      sortOrder: sortBy === 'current_quantity' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : undefined,
      render: (qty: number, record: MedicineWithStock) => {
        const min = record.min_stock_level ?? 0
        if (qty < min) return <span style={{ color: '#DC2626', fontWeight: 600 }}>{qty}</span>
        if (qty === min) return <span style={{ color: '#D97706', fontWeight: 500 }}>{qty}</span>
        return <span>{qty}</span>
      }
    },
    {
      title: 'Min Stock',
      dataIndex: 'min_stock_level',
      key: 'min_stock_level'
    },
    {
      title: 'Sell Price',
      dataIndex: 'unit_price_sell',
      key: 'unit_price_sell',
      render: (paisa: number) => formatCurrency(paisa ?? 0)
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_: unknown, record: MedicineWithStock) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record.id)} />
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          />
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Medicine Management
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Medicine
        </Button>
      </div>

      <Space wrap style={{ marginBottom: 16 }} align="center">
        <Input
          placeholder="Search by name, batch no..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 220 }}
        />
        <Input
          placeholder="Scan barcode to add new medicine"
          prefix={<BarcodeOutlined style={{ color: '#6B7280' }} />}
          style={{ width: 260 }}
          value={barcodeScanInput}
          onChange={(e) => setBarcodeScanInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const value = barcodeScanInput.trim()
              if (value) {
                setAddWithBarcode(value)
                setModalOpen(true)
                setEditId(null)
                setBarcodeScanInput('')
              }
            }
          }}
          allowClear
        />
        <Select
          placeholder="Category"
          value={categoryId === null ? 'all' : categoryId}
          onChange={(v) => setCategoryId(v === 'all' || v == null ? null : (v as number))}
          style={{ width: 160 }}
          options={[
            { value: 'all', label: 'All Categories' },
            ...categories.map((c) => ({ value: c.id, label: c.name }))
          ]}
        />
        <Select
          value={expiryStatus}
          onChange={setExpiryStatus}
          style={{ width: 180 }}
          options={EXPIRY_OPTIONS}
        />
        <Select
          value={stockStatus}
          onChange={setStockStatus}
          style={{ width: 140 }}
          options={STOCK_OPTIONS}
        />
        <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
          Reset Filters
        </Button>
        <Button onClick={handleExport}>Export to Excel</Button>
      </Space>

      {error && (
        <div style={{ color: '#DC2626', marginBottom: 8 }}>{error}</div>
      )}

      <div style={{ marginBottom: 8 }}>
        Showing {medicines.length} of {total} medicines
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={medicines}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `Total ${t} medicines`
          }}
          onChange={(pagination, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            handleTableChange(pagination, _filters, sorter)
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No medicines found. Click Add Medicine to get started."
              />
            )
          }}
        />
      )}

      <MedicineFormModal
        open={modalOpen}
        editId={editId}
        categories={categories}
        initialBarcode={addWithBarcode}
        onClose={() => { setModalOpen(false); setEditId(null); setAddWithBarcode(null) }}
        onSuccess={refetch}
      />
    </div>
  )
}
