import React, { useState } from 'react'
import { Modal, Form, Input, Typography, notification } from 'antd'
import { formatCurrency } from '@/utils/expiryStatus'
import { useAuthStore } from '@/store/authStore'

export function VoidBillModal(props: {
  open: boolean
  bill: { id: number; bill_number: string; total_amount: number }
  onClose: () => void
  onSuccess: () => void
}): React.ReactElement {
  const { open, bill, onClose, onSuccess } = props
  const { currentUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<{ reason: string }>()

  const handleOk = async (): Promise<void> => {
    const userId = currentUser?.id ?? null
    if (!userId) {
      notification.error({ message: 'Not signed in', description: 'Please sign in again.' })
      return
    }
    try {
      const values = await form.validateFields()
      setLoading(true)
      await window.api.invoke('billing:voidBill', {
        billId: bill.id,
        reason: values.reason.trim(),
        voidedBy: userId
      })
      notification.success({ message: 'Bill voided', description: `${bill.bill_number} has been voided.` })
      onSuccess()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in (err as Record<string, unknown>)) return
      notification.error({
        message: 'Failed to void bill',
        description: err instanceof Error ? err.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Void Bill"
      onCancel={onClose}
      onOk={() => { void handleOk() }}
      okText="Void Bill"
      okType="danger"
      confirmLoading={loading}
      destroyOnClose
    >
      <div style={{ marginBottom: 12 }}>
        <Typography.Text><strong>Bill:</strong> {bill.bill_number}</Typography.Text>
        <br />
        <Typography.Text><strong>Total:</strong> {formatCurrency(bill.total_amount ?? 0)}</Typography.Text>
      </div>

      <Form form={form} layout="vertical">
        <Form.Item
          label="Reason (required)"
          name="reason"
          rules={[
            { required: true, message: 'Please enter a reason.' },
            { min: 3, message: 'Reason must be at least 3 characters.' }
          ]}
        >
          <Input.TextArea rows={4} placeholder="Type the reason for voiding this bill..." />
        </Form.Item>
      </Form>
    </Modal>
  )
}

