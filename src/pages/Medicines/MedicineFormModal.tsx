import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, DatePicker, Row, Col, Spin, Button, notification } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import type { MedicineWithStock } from '@/hooks/useMedicines'

const dateFormat = 'DD/MM/YYYY'

export interface MedicineFormModalProps {
  open: boolean
  editId: number | null
  categories: { id: number; name: string }[]
  onClose: () => void
  onSuccess: () => void
}

interface FormValues {
  name: string
  category_id: number | null
  batch_no: string
  firm_name: string
  shelf_location?: string
  mfg_date: Dayjs | null
  expiry_date: Dayjs | null
  received_date: Dayjs | null
  order_date: Dayjs | null
  opening_stock: number
  min_stock_level: number
  buy_price_rs: number
  sell_price_rs: number
  notes?: string
}

export function MedicineFormModal({
  open,
  editId,
  categories,
  onClose,
  onSuccess
}: MedicineFormModalProps): React.ReactElement {
  const [form] = Form.useForm<FormValues>()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editName, setEditName] = useState<string>('')

  const isEdit = editId != null && editId > 0

  useEffect(() => {
    if (!open) return
    form.resetFields()
    setEditName('')
    if (isEdit) {
      setLoading(true)
      window.api
        .invoke<MedicineWithStock | null>('medicines:getById', editId)
        .then((medicine) => {
          if (medicine) {
            setEditName(medicine.name)
            form.setFieldsValue({
              name: medicine.name,
              category_id: medicine.category_id ?? null,
              batch_no: medicine.batch_no ?? '',
              firm_name: medicine.firm_name ?? '',
              shelf_location: medicine.shelf_location ?? undefined,
              mfg_date: medicine.mfg_date ? dayjs(medicine.mfg_date) : null,
              expiry_date: medicine.expiry_date ? dayjs(medicine.expiry_date) : null,
              received_date: medicine.received_date ? dayjs(medicine.received_date) : null,
              order_date: medicine.order_date ? dayjs(medicine.order_date) : null,
              opening_stock: medicine.current_quantity,
              min_stock_level: medicine.min_stock_level,
              buy_price_rs: (medicine.unit_price_buy ?? 0) / 100,
              sell_price_rs: (medicine.unit_price_sell ?? 0) / 100,
              notes: medicine.notes ?? undefined
            })
          }
        })
        .finally(() => setLoading(false))
    } else {
      form.setFieldsValue({
        opening_stock: 0,
        min_stock_level: 1,
        buy_price_rs: undefined,
        sell_price_rs: undefined
      })
    }
  }, [open, editId, isEdit, form])

  const handleFinish = async (values: FormValues): Promise<void> => {
    const mfgDate = values.mfg_date?.format('YYYY-MM-DD') ?? ''
    const expiryDate = values.expiry_date?.format('YYYY-MM-DD') ?? ''
    const receivedDate = values.received_date?.format('YYYY-MM-DD') ?? ''
    const orderDate = values.order_date?.format('YYYY-MM-DD') ?? null

    if (expiryDate && mfgDate && !dayjs(expiryDate).isAfter(dayjs(mfgDate))) {
      form.setFields([{ name: 'expiry_date', errors: ['Expiry date must be after manufacturing date.'] }])
      return
    }

    const buyPaisa = Math.round((values.buy_price_rs ?? 0) * 100)
    const sellPaisa = Math.round((values.sell_price_rs ?? 0) * 100)
    if (sellPaisa < buyPaisa) {
      form.setFields([{ name: 'sell_price_rs', errors: ['Sell price must be greater than or equal to buy price.'] }])
      return
    }

    setSaving(true)
    try {
      if (isEdit) {
        await window.api.invoke('medicines:update', {
          id: editId,
          name: values.name.trim(),
          category_id: values.category_id,
          batch_no: values.batch_no.trim(),
          firm_name: values.firm_name.trim(),
          shelf_location: values.shelf_location?.trim() ?? null,
          mfg_date: mfgDate,
          expiry_date: expiryDate,
          received_date: receivedDate,
          order_date: orderDate,
          unit_price_buy: buyPaisa,
          unit_price_sell: sellPaisa,
          min_stock_level: values.min_stock_level,
          notes: values.notes?.trim() ?? null
        })
        notification.success({ message: 'Medicine updated successfully.' })
      } else {
        await window.api.invoke<{ id: number }>('medicines:create', {
          name: values.name.trim(),
          category_id: values.category_id,
          batch_no: values.batch_no.trim(),
          firm_name: values.firm_name.trim(),
          shelf_location: values.shelf_location?.trim() ?? null,
          mfg_date: mfgDate,
          expiry_date: expiryDate,
          received_date: receivedDate,
          order_date: orderDate,
          opening_stock: values.opening_stock ?? 0,
          unit_price_buy: buyPaisa,
          unit_price_sell: sellPaisa,
          min_stock_level: values.min_stock_level ?? 1,
          notes: values.notes?.trim() ?? null
        })
        notification.success({ message: 'Medicine added successfully.' })
      }
      onSuccess()
      onClose()
    } catch (err) {
      notification.error({
        message: isEdit ? 'Update failed' : 'Add failed',
        description: err instanceof Error ? err.message : 'Something went wrong.'
      })
    } finally {
      setSaving(false)
    }
  }

  const title = isEdit ? `Edit Medicine: ${editName || '…'}` : 'Add New Medicine'

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width={720}
      destroyOnClose
      footer={null}
      maskClosable={!saving}
      closable={!saving}
    >
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{
            min_stock_level: 1,
            opening_stock: 0
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Medicine Name"
                rules={[{ required: true, message: 'Please enter medicine name.' }]}
              >
                <Input placeholder="Medicine name" />
              </Form.Item>
              <Form.Item
                name="category_id"
                label="Category"
                rules={[{ required: true, message: 'Please select a category.' }]}
              >
                <Select
                  placeholder="Select category"
                  allowClear
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Form.Item>
              <Form.Item
                name="batch_no"
                label="Batch Number"
                rules={[{ required: true, message: 'Please enter batch number.' }]}
              >
                <Input placeholder="Batch number" />
              </Form.Item>
              <Form.Item
                name="firm_name"
                label="Manufacturer / Firm Name"
                rules={[{ required: true, message: 'Please enter manufacturer name.' }]}
              >
                <Input placeholder="Manufacturer / firm name" />
              </Form.Item>
              <Form.Item name="shelf_location" label="Shelf Location">
                <Input placeholder="Shelf location (optional)" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="mfg_date"
                label="Manufacturing Date"
                rules={[{ required: true, message: 'Please select manufacturing date.' }]}
              >
                <DatePicker format={dateFormat} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="expiry_date"
                label="Expiry Date"
                rules={[{ required: true, message: 'Please select expiry date.' }]}
              >
                <DatePicker format={dateFormat} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="received_date"
                label="Received Date"
                rules={[{ required: true, message: 'Please select received date.' }]}
              >
                <DatePicker format={dateFormat} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="order_date" label="Supply Order Date">
                <DatePicker format={dateFormat} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="opening_stock"
                label="Opening Stock"
                rules={[
                  { required: true, message: 'Please enter opening stock.' },
                  { type: 'number', min: 0, message: 'Opening stock cannot be negative.' }
                ]}
              >
                <InputNumber min={0} style={{ width: '100%' }} disabled={isEdit} />
              </Form.Item>
              <Form.Item
                name="min_stock_level"
                label="Minimum Stock Level"
                rules={[
                  { required: true, message: 'Please enter minimum stock level.' },
                  { type: 'number', min: 1, message: 'Minimum stock level must be at least 1.' }
                ]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="buy_price_rs"
                label="Buy Price (Rs.)"
                rules={[{ required: true, message: 'Please enter buy price.' }]}
              >
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="Rs." />
              </Form.Item>
              <Form.Item
                name="sell_price_rs"
                label="Sell Price (Rs.)"
                rules={[{ required: true, message: 'Please enter sell price.' }]}
              >
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="Rs." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={4} placeholder="Notes (optional)" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="primary" onClick={() => form.submit()} loading={saving}>
                Save
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  )
}
