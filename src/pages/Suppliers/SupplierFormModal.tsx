import React, { useEffect } from 'react'
import { Modal, Form, Input, Switch, Button, notification } from 'antd'

export interface SupplierFormValues {
  name: string
  contact_person: string
  phone: string
  email?: string
  address?: string
  ntn_cnic?: string
  payment_terms?: string
  notes?: string
  is_active: boolean
}

export interface SupplierFormModalProps {
  open: boolean
  editId: number | null
  initialValues?: Partial<SupplierFormValues>
  onClose: () => void
  onSuccess: () => void
}

export function SupplierFormModal({
  open,
  editId,
  initialValues,
  onClose,
  onSuccess
}: SupplierFormModalProps): React.ReactElement {
  const [form] = Form.useForm<SupplierFormValues>()
  const [saving, setSaving] = React.useState(false)

  const isEdit = editId != null && editId > 0

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (initialValues) {
      form.setFieldsValue({
        name: initialValues.name ?? '',
        contact_person: initialValues.contact_person ?? '',
        phone: initialValues.phone ?? '',
        email: initialValues.email ?? undefined,
        address: initialValues.address ?? undefined,
        ntn_cnic: initialValues.ntn_cnic ?? undefined,
        payment_terms: initialValues.payment_terms ?? undefined,
        notes: initialValues.notes ?? undefined,
        is_active: initialValues.is_active ?? true
      })
    } else if (!isEdit) {
      form.setFieldsValue({ is_active: true })
    }
  }, [open, editId, initialValues, isEdit, form])

  const handleFinish = async (values: SupplierFormValues): Promise<void> => {
    setSaving(true)
    try {
      if (isEdit) {
        await window.api.invoke('suppliers:update', {
          id: editId,
          name: values.name.trim(),
          contact_person: values.contact_person.trim(),
          phone: values.phone.trim(),
          email: values.email?.trim() || null,
          address: values.address?.trim() || null,
          ntn_cnic: values.ntn_cnic?.trim() || null,
          notes: values.notes?.trim() || null,
          is_active: values.is_active
        })
        notification.success({ message: 'Supplier updated.' })
      } else {
        await window.api.invoke<{ id: number }>('suppliers:create', {
          name: values.name.trim(),
          contact_person: values.contact_person.trim(),
          phone: values.phone.trim(),
          email: values.email?.trim() || null,
          address: values.address?.trim() || null,
          ntn_cnic: values.ntn_cnic?.trim() || null,
          notes: values.notes?.trim() || null,
          is_active: values.is_active
        })
        notification.success({ message: 'Supplier added.' })
      }
      onClose()
      setTimeout(() => onSuccess(), 100)
    } catch (err) {
      notification.error({
        message: isEdit ? 'Update failed' : 'Add failed',
        description: err instanceof Error ? err.message : 'Something went wrong.'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Supplier' : 'Add Supplier'}
      open={open}
      onCancel={onClose}
      width={560}
      destroyOnClose
      footer={null}
      maskClosable={!saving}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ is_active: true }}
      >
        <Form.Item
          name="name"
          label="Supplier Name"
          rules={[{ required: true, message: 'Please enter supplier name.' }]}
        >
          <Input placeholder="Supplier name" />
        </Form.Item>
        <Form.Item
          name="contact_person"
          label="Contact Person"
          rules={[{ required: true, message: 'Please enter contact person.' }]}
        >
          <Input placeholder="Contact person" />
        </Form.Item>
        <Form.Item
          name="phone"
          label="Phone"
          rules={[{ required: true, message: 'Please enter phone.' }]}
        >
          <Input placeholder="Phone" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email"
          rules={[{ type: 'email', message: 'Please enter a valid email.' }]}
        >
          <Input placeholder="Email (optional)" />
        </Form.Item>
        <Form.Item name="address" label="Address">
          <Input.TextArea rows={2} placeholder="Address (optional)" />
        </Form.Item>
        <Form.Item name="ntn_cnic" label="NTN/CNIC">
          <Input placeholder="NTN/CNIC (optional)" />
        </Form.Item>
        <Form.Item name="payment_terms" label="Payment Terms">
          <Input placeholder="Payment terms (optional)" />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Notes (optional)" />
        </Form.Item>
        <Form.Item name="is_active" label="Active" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
          <Button onClick={onClose} disabled={saving} style={{ marginRight: 8 }}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
