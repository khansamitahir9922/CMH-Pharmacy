import React, { useState, useEffect } from 'react'
import { Modal, Form, InputNumber, DatePicker, Input, Button, notification } from 'antd'
import dayjs from 'dayjs'
import { formatCurrency } from '@/utils/expiryStatus'

export interface RecordPaymentModalProps {
  orderId: number
  onClose: () => void
  onSuccess: () => void
}

export function RecordPaymentModal({ orderId, onClose, onSuccess }: RecordPaymentModalProps): React.ReactElement {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState<{
    order_number: string
    supplier_name: string | null
    total_amount: number
    paid_amount: number
  } | null>(null)

  useEffect(() => {
    window.api
      .invoke<{ order: { order_number: string; supplier_name: string | null; total_amount: number; paid_amount: number }; items: unknown[] } | null>('suppliers:getPurchaseOrderById', orderId)
      .then((data) => {
        if (data?.order) setOrder(data.order)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [orderId])

  useEffect(() => {
    if (order) {
      const remaining = order.total_amount - order.paid_amount
      form.setFieldsValue({
        amount: undefined,
        payment_date: dayjs(),
        notes: '',
        _remaining: remaining
      })
    }
  }, [order, form])

  const handleSubmit = async (): Promise<void> => {
    const values = await form.validateFields().catch(() => null)
    if (!values || !order) return
    const remaining = order.total_amount - order.paid_amount
    if (values.amount > remaining) {
      form.setFields([{ name: 'amount', errors: ['Amount cannot exceed remaining balance.'] }])
      return
    }
    setSaving(true)
    try {
      await window.api.invoke('suppliers:recordPayment', orderId, Math.round(values.amount * 100))
      notification.success({ message: 'Payment recorded.' })
      onSuccess()
      onClose()
    } catch (err) {
      notification.error({
        message: 'Failed to record payment',
        description: err instanceof Error ? err.message : 'Unknown error'
      })
    } finally {
      setSaving(false)
    }
  }

  if (!order) return <Modal open onCancel={onClose} footer={null} title="Record Payment">{loading ? 'Loading...' : 'Order not found.'}</Modal>

  const remaining = order.total_amount - order.paid_amount
  const remainingRs = remaining / 100 // total/paid are in paisa

  return (
    <Modal
      title="Record Payment"
      open
      onCancel={onClose}
      footer={null}
      width={440}
      destroyOnClose
    >
      <p><strong>Supplier:</strong> {order.supplier_name ?? '—'}</p>
      <p><strong>Order#:</strong> {order.order_number}</p>
      <p><strong>Total:</strong> {formatCurrency(order.total_amount)} &nbsp; <strong>Paid:</strong> {formatCurrency(order.paid_amount)}</p>
      <p><strong>Remaining:</strong> {formatCurrency(remaining)}</p>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="amount"
          label="Amount to pay (Rs.)"
          rules={[
            { required: true, message: 'Enter amount.' },
            { type: 'number', min: 0.01, message: 'Amount must be greater than 0.' }
          ]}
        >
          <InputNumber min={0.01} max={remainingRs} step={0.01} style={{ width: '100%' }} addonAfter="Rs." />
        </Form.Item>
        <Form.Item name="payment_date" label="Payment Date" rules={[{ required: true }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Optional notes" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button onClick={onClose} disabled={saving} style={{ marginRight: 8 }}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={saving}>Record Payment</Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
