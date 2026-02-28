import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Modal, Form, Select, DatePicker, InputNumber, Input, Button, Table, notification } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { formatCurrency } from '@/utils/expiryStatus'
import { useAuthStore } from '@/store/authStore'

interface MedicineOption {
  id: number
  name: string
  batch_no: string | null
  unit_price_buy: number
}

interface LineItem {
  medicine_id: number
  medicine_name: string
  quantity_ordered: number
  unit_price: number
  total: number
}

export interface PurchaseOrderModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const dateFormat = 'DD/MM/YYYY'

export function PurchaseOrderModal({ open, onClose, onSuccess }: PurchaseOrderModalProps): React.ReactElement {
  const { currentUser } = useAuthStore()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([])
  const [medicineOptions, setMedicineOptions] = useState<MedicineOption[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [selectedMedicineId, setSelectedMedicineId] = useState<number | null>(null)
  const [qty, setQty] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)

  useEffect(() => {
    if (open) {
      window.api.invoke<{ id: number; name: string }[]>('suppliers:getAll').then((list) => {
        setSuppliers(Array.isArray(list) ? list : [])
      }).catch(() => setSuppliers([]))
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({ order_date: dayjs() })
    setLineItems([])
    setSelectedMedicineId(null)
    setQty(1)
    setUnitPrice(0)
  }, [open, form])

  /** Load first 100 medicines for dropdown (when user opens without typing). */
  const loadInitialMedicines = useCallback((): void => {
    window.api
      .invoke<{ data?: unknown }>('medicines:getAll', {
        page: 1,
        pageSize: 100,
        search: '',
        sortBy: 'name',
        sortOrder: 'asc'
      })
      .then((res) => {
        const data = res?.data
        setMedicineOptions(Array.isArray(data) ? (data as MedicineOption[]) : [])
      })
      .catch(() => setMedicineOptions([]))
  }, [])

  const loadMedicineOptions = (search: string): void => {
    if (!search?.trim()) {
      loadInitialMedicines()
      return
    }
    window.api.invoke<MedicineOption[]>('medicines:search', search).then((list) => {
      setMedicineOptions(Array.isArray(list) ? list : [])
    }).catch(() => setMedicineOptions([]))
  }

  const debouncedSearch = useMemo(() => {
    let t: ReturnType<typeof setTimeout>
    return (v: string) => {
      clearTimeout(t)
      t = setTimeout(() => loadMedicineOptions(v), 300)
    }
  }, [])

  const handleSelectMedicine = (medicineId: number | null, option?: { unit_price_buy?: number }): void => {
    setSelectedMedicineId(medicineId)
    const paisa = option?.unit_price_buy ?? medicineOptions.find((m) => m.id === medicineId)?.unit_price_buy ?? 0
    setUnitPrice(paisa / 100)
  }

  const handleAddLine = (): void => {
    if (!selectedMedicineId || qty < 1) return
    const med = medicineOptions.find((m) => m.id === selectedMedicineId)
    const name = med ? med.name + (med.batch_no ? ` (${med.batch_no})` : '') : 'Medicine'
    const pricePaisa = unitPrice >= 0 ? Math.round(unitPrice * 100) : (med?.unit_price_buy ?? 0)
    const total = qty * pricePaisa
    if (lineItems.some((i) => i.medicine_id === selectedMedicineId)) {
      notification.warning({ message: 'This medicine is already in the order. Update quantity or remove first.' })
      return
    }
    setLineItems((prev) => [...prev, { medicine_id: selectedMedicineId, medicine_name: name, quantity_ordered: qty, unit_price: pricePaisa, total }])
    setSelectedMedicineId(null)
    setQty(1)
    setUnitPrice(0)
  }

  const handleRemoveLine = (medicineId: number): void => {
    setLineItems((prev) => prev.filter((i) => i.medicine_id !== medicineId))
  }

  const orderTotal = lineItems.reduce((sum, i) => sum + i.total, 0)

  const handleSubmit = async (): Promise<void> => {
    const values = await form.validateFields().catch(() => null)
    if (!values || !lineItems.length) {
      if (!lineItems.length) notification.error({ message: 'Add at least one item to the order.' })
      return
    }
    const orderDate = values.order_date
    const orderDateStr = orderDate && typeof orderDate.format === 'function' ? orderDate.format('YYYY-MM-DD') : ''
    if (!orderDateStr) {
      notification.error({ message: 'Please select an order date.' })
      return
    }
    setSaving(true)
    try {
      await window.api.invoke<{ id: number; order_number: string }>('suppliers:createPurchaseOrder', {
        supplier_id: values.supplier_id,
        order_date: orderDateStr,
        expected_date: values.expected_date && typeof values.expected_date.format === 'function' ? values.expected_date.format('YYYY-MM-DD') : null,
        notes: values.notes?.trim() || null,
        created_by: currentUser?.id ?? null,
        items: lineItems.map((i) => ({
          medicine_id: i.medicine_id,
          quantity_ordered: i.quantity_ordered,
          unit_price: i.unit_price
        }))
      })
      notification.success({ message: 'Purchase order created.' })
      onSuccess()
      onClose()
    } catch (err) {
      notification.error({
        message: 'Failed to create order',
        description: err instanceof Error ? err.message : 'Unknown error'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="New Purchase Order"
      open={open}
      onCancel={onClose}
      width={720}
      destroyOnClose
      footer={null}
      maskClosable={!saving}
    >
      <Form form={form} layout="vertical" initialValues={{ order_date: dayjs() }}>
        <Form.Item name="supplier_id" label="Supplier" rules={[{ required: true, message: 'Select supplier.' }]}>
          <Select
            placeholder="Select supplier"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Form.Item>
        <Form.Item name="order_date" label="Order Date" rules={[{ required: true }]}>
          <DatePicker format={dateFormat} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="expected_date" label="Expected Delivery Date">
          <DatePicker format={dateFormat} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Optional notes" />
        </Form.Item>
      </Form>

      <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600 }}>Add items</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Select
          showSearch
          placeholder="Search or select medicine"
          filterOption={false}
          onSearch={debouncedSearch}
          onDropdownVisibleChange={(open) => {
            if (open && medicineOptions.length === 0) loadInitialMedicines()
          }}
          style={{ width: 240 }}
          value={selectedMedicineId ?? undefined}
          onChange={(v, option) => handleSelectMedicine(v ?? null, option as { unit_price_buy?: number })}
          onClear={() => handleSelectMedicine(null)}
          allowClear
          options={medicineOptions.map((m) => ({
            value: m.id,
            label: `${m?.name ?? ''}${m?.batch_no ? ` (${m.batch_no})` : ''} — ${formatCurrency(m?.unit_price_buy ?? 0)}`,
            unit_price_buy: m?.unit_price_buy ?? 0
          }))}
          fieldNames={{ value: 'value', label: 'label' }}
        />
        <InputNumber min={1} value={qty} onChange={(v) => setQty(v ?? 1)} placeholder="Qty" style={{ width: 80 }} />
        <InputNumber
          min={0}
          step={0.01}
          value={unitPrice}
          onChange={(v) => setUnitPrice(v ?? 0)}
          placeholder="Unit price (Rs.)"
          style={{ width: 120 }}
          addonAfter="Rs."
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddLine}>
          Add to Order
        </Button>
      </div>

      <Table
        size="small"
        dataSource={lineItems}
        rowKey="medicine_id"
        columns={[
          { title: 'Medicine', dataIndex: 'medicine_name', key: 'medicine_name' },
          { title: 'Qty', dataIndex: 'quantity_ordered', key: 'quantity_ordered', width: 80 },
          { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', render: (v) => formatCurrency(v) },
          { title: 'Total', dataIndex: 'total', key: 'total', render: (v) => formatCurrency(v) },
          {
            title: '',
            key: 'remove',
            width: 60,
            render: (_, r) => (
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveLine(r.medicine_id)} />
            )
          }
        ]}
        pagination={false}
        style={{ marginTop: 12 }}
        locale={{ emptyText: 'No items added yet' }}
      />
      {lineItems.length > 0 && (
        <div style={{ marginTop: 12, fontWeight: 600 }}>
          Order total: {formatCurrency(orderTotal)}
        </div>
      )}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="primary" onClick={handleSubmit} loading={saving} disabled={lineItems.length === 0}>
          Create Order
        </Button>
      </div>
    </Modal>
  )
}
