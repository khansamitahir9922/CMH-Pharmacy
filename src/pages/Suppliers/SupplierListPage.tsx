import React, { useState, useEffect } from 'react'
import { Typography, Button, Input, Table, Space, Modal, message } from 'antd'
import { PlusOutlined, EditOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '@/utils/expiryStatus'
import { SupplierFormModal } from './SupplierFormModal'

interface SupplierRow {
  id: number
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  total_orders: number
  outstanding_balance: number
  is_active: boolean
}

export function SupplierListPage(): React.ReactElement {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editInitial, setEditInitial] = useState<Partial<Record<string, unknown>> | undefined>(undefined)

  const fetchSuppliers = (searchTerm?: string): void => {
    const term = searchTerm !== undefined ? searchTerm : search
    setLoading(true)
    window.api
      .invoke<SupplierRow[]>('suppliers:getAll', term || undefined)
      .then((list) => setSuppliers(list ?? []))
      .catch(() => setSuppliers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSuppliers()
  }, [search])

  /** Call after add/edit so the list refreshes and shows all suppliers (clears search so new one is visible). */
  const handleSaveSuccess = (): void => {
    setSearch('')
    fetchSuppliers('')
  }

  const handleAdd = (): void => {
    setEditId(null)
    setEditInitial(undefined)
    setModalOpen(true)
  }

  const handleEdit = async (record: SupplierRow): Promise<void> => {
    const detail = await window.api.invoke<SupplierRow & { address?: string | null; ntn_cnic?: string | null; notes?: string | null } | null>('suppliers:getById', record.id)
    if (detail) {
      setEditInitial({
        name: detail.name,
        contact_person: detail.contact_person ?? '',
        phone: detail.phone ?? '',
        email: detail.email ?? undefined,
        address: detail.address ?? undefined,
        ntn_cnic: detail.ntn_cnic ?? undefined,
        notes: detail.notes ?? undefined,
        is_active: detail.is_active
      })
    }
    setEditId(record.id)
    setModalOpen(true)
  }

  const handleViewOrders = (record: SupplierRow): void => {
    navigate(`/suppliers/orders?supplierId=${record.id}`)
  }

  const handleDelete = (record: SupplierRow): void => {
    Modal.confirm({
      title: 'Delete supplier?',
      content: `Are you sure you want to delete "${record.name}"? This will soft-deactivate the supplier.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await window.api.invoke('suppliers:delete', record.id)
          message.success('Supplier deleted.')
          fetchSuppliers()
        } catch (err) {
          message.error(err instanceof Error ? err.message : 'Failed to delete.')
        }
      }
    })
  }

  const columns: ColumnsType<SupplierRow> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Contact Person', dataIndex: 'contact_person', key: 'contact_person', render: (v) => v ?? '—' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: (v) => v ?? '—' },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (v) => v ?? '—' },
    { title: 'Total Orders', dataIndex: 'total_orders', key: 'total_orders', width: 110 },
    {
      title: 'Outstanding Balance',
      dataIndex: 'outstanding_balance',
      key: 'outstanding_balance',
      width: 150,
      render: (val: number) => (
        <span style={val > 0 ? { color: '#DC2626', fontWeight: 500 } : undefined}>
          {formatCurrency(val ?? 0)}
        </span>
      )
    },
    {
      title: 'Status',
      key: 'status',
      width: 90,
      render: (_, r) => (r.is_active ? 'Active' : 'Inactive')
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewOrders(record)}>
            View Orders
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Supplier Management
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Supplier
        </Button>
      </div>
      <Input.Search
        placeholder="Search by supplier name or phone"
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onSearch={(v) => setSearch(v)}
        style={{ width: 320, marginBottom: 16 }}
      />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={suppliers}
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `Total ${t} suppliers` }}
        scroll={{ x: 900 }}
      />
      <SupplierFormModal
        open={modalOpen}
        editId={editId}
        initialValues={editInitial as Parameters<typeof SupplierFormModal>[0]['initialValues']}
        onClose={() => { setModalOpen(false); setEditId(null); setEditInitial(undefined) }}
        onSuccess={handleSaveSuccess}
      />
    </div>
  )
}
