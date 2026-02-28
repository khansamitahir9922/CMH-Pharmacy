import React, { useEffect, useState } from 'react'
import { Typography, Button, Empty, Input, Table, Space, Modal, message } from 'antd'
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { formatDate } from '@/utils/expiryStatus'
import type { PrescriptionListRow } from '@/db/queries/prescriptions'
import { PrescriptionFormModal } from './PrescriptionFormModal'

export function PrescriptionsPage(): React.ReactElement {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<PrescriptionListRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [viewRow, setViewRow] = useState<PrescriptionListRow | null>(null)

  const fetchList = (): void => {
    setLoading(true)
    window.api
      .invoke<{ data: PrescriptionListRow[]; total: number }>('prescriptions:getAll', {
        search: search.trim() || null,
        page,
        pageSize
      })
      .then((res) => {
        setRows(res?.data ?? [])
        setTotal(res?.total ?? 0)
      })
      .catch(() => {
        setRows([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchList()
  }, [page, pageSize, search])

  const handleAdd = (): void => {
    setEditId(null)
    setModalOpen(true)
  }

  const handleEdit = (record: PrescriptionListRow): void => {
    setEditId(record.id)
    setModalOpen(true)
  }

  const handleDelete = (record: PrescriptionListRow): void => {
    Modal.confirm({
      title: 'Delete prescription?',
      content: `Patient: ${record.patient_name}. This cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await window.api.invoke('prescriptions:delete', record.id)
          message.success('Prescription deleted.')
          fetchList()
        } catch {
          message.error('Failed to delete.')
        }
      }
    })
  }

  const columns: ColumnsType<PrescriptionListRow> = [
    {
      title: 'Date',
      dataIndex: 'prescription_date',
      key: 'prescription_date',
      width: 110,
      render: (v) => (v ? formatDate(v) : '—')
    },
    { title: 'Patient', dataIndex: 'patient_name', key: 'patient_name', width: 140 },
    { title: 'Doctor', dataIndex: 'doctor_name', key: 'doctor_name', width: 140, render: (v) => v ?? '—' },
    { title: 'Medicines Count', dataIndex: 'medicines_count', key: 'medicines_count', width: 120 },
    {
      title: 'Has Image',
      key: 'has_image',
      width: 100,
      render: (_, r) => (r.has_image ? 'Yes' : '—')
    },
    {
      title: 'Linked Bill',
      dataIndex: 'linked_bill_number',
      key: 'linked_bill_number',
      width: 130,
      render: (v) => v ?? '—'
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewRow(record)} />
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Prescriptions
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          New Prescription
        </Button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by patient name or doctor name"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          allowClear
          style={{ width: 320 }}
        />
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        locale={{ emptyText: <Empty description="No prescriptions found. Click New Prescription to add one." /> }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (t) => `Total ${t} prescriptions`
        }}
        onChange={(p) => {
          if (p.current) setPage(p.current)
          if (p.pageSize) setPageSize(p.pageSize)
        }}
      />
      <PrescriptionFormModal open={modalOpen} editId={editId} onClose={() => { setModalOpen(false); setEditId(null) }} onSuccess={fetchList} />
      <Modal
        open={!!viewRow}
        title={viewRow ? `Prescription — ${viewRow.patient_name}` : 'Prescription'}
        onCancel={() => setViewRow(null)}
        footer={viewRow ? <Button onClick={() => { setViewRow(null); handleEdit(viewRow) }}>Edit</Button> : null}
        width={560}
      >
        {viewRow && (
          <div>
            <p><strong>Date:</strong> {formatDate(viewRow.prescription_date)}</p>
            <p><strong>Patient:</strong> {viewRow.patient_name}{viewRow.patient_age ? ` (${viewRow.patient_age} yrs)` : ''}</p>
            <p><strong>Doctor:</strong> {viewRow.doctor_name ?? '—'}</p>
            <p><strong>Medicines prescribed:</strong></p>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, whiteSpace: 'pre-wrap' }}>
              {viewRow.medicines_prescribed || '—'}
            </pre>
            <p><strong>Linked Bill:</strong> {viewRow.linked_bill_number ?? '—'}</p>
            {viewRow.notes && <p><strong>Notes:</strong> {viewRow.notes}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
