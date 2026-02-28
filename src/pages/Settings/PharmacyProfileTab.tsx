import React, { useState, useEffect } from 'react'
import { Form, Input, InputNumber, Select, Button, Card, notification } from 'antd'
import type { Store } from 'antd/es/form/interface'

const SESSION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '60 minutes' },
  { value: '120', label: '120 minutes' }
]

const CURRENCY_OPTIONS = [
  { value: 'Rs.', label: 'Rs.' },
  { value: 'PKR', label: 'PKR' }
]

export function PharmacyProfileTab(): React.ReactElement {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api
      .invoke<Record<string, string | null>>('settings:getAll')
      .then((data) => {
        if (data) {
          form.setFieldsValue({
            pharmacy_name: data.pharmacy_name ?? '',
            pharmacy_address: data.pharmacy_address ?? '',
            pharmacy_phone: data.pharmacy_phone ?? '',
            pharmacy_email: data.pharmacy_email ?? '',
            license_no: data.license_no ?? '',
            ntn: data.ntn ?? '',
            gst_percent: data.gst_percent != null ? Number(data.gst_percent) : 0,
            currency_symbol: data.currency_symbol ?? 'Rs.',
            session_timeout_minutes: data.session_timeout_minutes ?? '30'
          })
        }
      })
      .catch(() => notification.error({ message: 'Failed to load settings' }))
      .finally(() => setLoading(false))
  }, [form])

  const onFinish = (values: Store): void => {
    setSaving(true)
    const payload: Record<string, string | number> = {
      pharmacy_name: values.pharmacy_name ?? '',
      pharmacy_address: values.pharmacy_address ?? '',
      pharmacy_phone: values.pharmacy_phone ?? '',
      pharmacy_email: values.pharmacy_email ?? '',
      license_no: values.license_no ?? '',
      ntn: values.ntn ?? '',
      gst_percent: Number(values.gst_percent) ?? 0,
      currency_symbol: values.currency_symbol ?? 'Rs.',
      session_timeout_minutes: String(values.session_timeout_minutes ?? '30')
    }
    window.api
      .invoke('settings:updateAll', payload)
      .then(() => {
        notification.success({ message: 'Settings saved' })
      })
      .catch(() => notification.error({ message: 'Failed to save settings' }))
      .finally(() => setSaving(false))
  }

  return (
    <Card title="Pharmacy Profile" loading={loading}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="pharmacy_name" label="Pharmacy Name (appears on bills)" rules={[{ required: true }]}>
          <Input placeholder="Pharmacy name" />
        </Form.Item>
        <Form.Item name="pharmacy_address" label="Address">
          <Input.TextArea rows={2} placeholder="Address" />
        </Form.Item>
        <Form.Item name="pharmacy_phone" label="Phone">
          <Input placeholder="Phone" />
        </Form.Item>
        <Form.Item name="pharmacy_email" label="Email">
          <Input placeholder="Email" />
        </Form.Item>
        <Form.Item name="license_no" label="License No">
          <Input placeholder="License number" />
        </Form.Item>
        <Form.Item name="ntn" label="NTN">
          <Input placeholder="NTN" />
        </Form.Item>
        <Form.Item
          name="gst_percent"
          label="Default GST %"
          rules={[{ type: 'number', min: 0, max: 30 }]}
          initialValue={0}
        >
          <InputNumber min={0} max={30} style={{ width: 120 }} addonAfter="%" />
        </Form.Item>
        <Form.Item name="currency_symbol" label="Currency Symbol">
          <Select options={CURRENCY_OPTIONS} style={{ width: 120 }} />
        </Form.Item>
        <Form.Item name="session_timeout_minutes" label="Session Timeout">
          <Select options={SESSION_OPTIONS} style={{ width: 200 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}
