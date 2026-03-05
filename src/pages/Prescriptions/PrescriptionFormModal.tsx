import React, { useEffect, useRef, useState } from 'react'
import { Modal, Form, Input, InputNumber, DatePicker, Button, Upload, Select, notification } from 'antd'
import { selectAllOnFocus } from '../../utils/inputUtils'
import type { UploadFile } from 'antd'
import { UploadOutlined, FileImageOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import type { PrescriptionRow } from '@/db/queries/prescriptions'

const dateFormat = 'DD/MM/YYYY'

export interface PrescriptionFormModalProps {
  open: boolean
  editId: number | null
  onClose: () => void
  onSuccess: () => void
}

interface FormValues {
  patient_name: string
  patient_age: number | null
  doctor_name: string
  prescription_date: Dayjs | null
  medicines_prescribed: string
  image_path?: string
  bill_id: number | null
  notes: string
}

export function PrescriptionFormModal({ open, editId, onClose, onSuccess }: PrescriptionFormModalProps): React.ReactElement {
  const [form] = Form.useForm<FormValues>()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recentBills, setRecentBills] = useState<{ id: number; bill_number: string }[]>([])
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [previewDataUrl, setPreviewDataUrl] = useState<{ dataUrl: string; isPdf: boolean } | null>(null)
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)
  const previewObjectUrlRef = useRef<string | null>(null)
  const previewDataUrlRef = useRef<{ dataUrl: string; isPdf: boolean } | null>(null)

  const isEdit = editId != null && editId > 0

  useEffect(() => {
    if (!open) {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current)
        previewObjectUrlRef.current = null
      }
      setPreviewObjectUrl(null)
      previewDataUrlRef.current = null
      return
    }
    form.resetFields()
    setImagePath(null)
    setFileList([])
    setPreviewDataUrl(null)
    setPreviewObjectUrl(null)
    window.api
      .invoke<{ data: { id: number; bill_number: string }[] }>('billing:getBills', { page: 1, pageSize: 50 })
      .then((res) => setRecentBills(res?.data ?? []))
      .catch(() => setRecentBills([]))
    if (isEdit) {
      setLoading(true)
      window.api
        .invoke<PrescriptionRow | null>('prescriptions:getById', editId)
        .then((row) => {
          if (row) {
            form.setFieldsValue({
              patient_name: row.patient_name,
              patient_age: row.patient_age ?? null,
              doctor_name: row.doctor_name ?? '',
              prescription_date: row.prescription_date ? dayjs(row.prescription_date) : null,
              medicines_prescribed: row.medicines_prescribed ?? '',
              bill_id: row.bill_id ?? null,
              notes: row.notes ?? ''
            })
            setImagePath(row.image_path ?? null)
            if (row.image_path) {
              const ext = row.image_path.toLowerCase()
              setFileList([
                {
                  uid: '1',
                  name: ext.endsWith('.pdf') ? 'prescription.pdf' : 'prescription.jpg',
                  status: 'done'
                }
              ])
              window.api
                .invoke<{ dataUrl: string; isPdf: boolean } | null>('prescriptions:getImageDataUrl', { imagePath: row.image_path })
                .then((res) => res && setPreviewDataUrl(res))
                .catch(() => {})
            }
          }
        })
        .finally(() => setLoading(false))
    }
  }, [open, editId, isEdit, form])

  const handleFinish = async (values: FormValues): Promise<void> => {
    setSaving(true)
    try {
      const prescriptionDate = values.prescription_date?.format('YYYY-MM-DD') ?? ''
      if (!prescriptionDate) {
        form.setFields([{ name: 'prescription_date', errors: ['Prescription date is required.'] }])
        setSaving(false)
        return
      }
      const payload = {
        patient_name: values.patient_name.trim(),
        patient_age: values.patient_age ?? null,
        doctor_name: values.doctor_name.trim(),
        prescription_date: prescriptionDate,
        medicines_prescribed: values.medicines_prescribed?.trim() || null,
        image_path: imagePath ?? null,
        notes: values.notes?.trim() || null,
        bill_id: values.bill_id ?? null
      }
      if (isEdit) {
        await window.api.invoke('prescriptions:update', { ...payload, id: editId })
        notification.success({ message: 'Prescription updated.' })
      } else {
        await window.api.invoke('prescriptions:create', payload)
        notification.success({ message: 'Prescription added.' })
      }
      onSuccess()
      onClose()
    } catch (err) {
      notification.error({
        message: isEdit ? 'Update failed' : 'Add failed',
        description: err instanceof Error ? err.message : 'Unknown error'
      })
    } finally {
      setSaving(false)
    }
  }

  const beforeUpload = (file: File): boolean => {
    const isImage = file.type === 'image/jpeg' || file.type === 'image/png'
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) {
      notification.error({ message: 'Only JPG, PNG, or PDF allowed.' })
      return false
    }
    const isPdfType = isPdf
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    }
    setFileList([{ uid: '1', name: file.name, status: 'done' }])
    if (isPdfType) {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = (reader.result as string) ?? ''
        if (!dataUrl) return
        const payload = { dataUrl, isPdf: true }
        previewDataUrlRef.current = payload
        setPreviewDataUrl(payload)
        setPreviewObjectUrl(null)
        const base64 = dataUrl.replace(/^data:\w+\/\w+;base64,/, '')
        window.api
          .invoke<string>('prescriptions:saveImage', { base64, extension: 'pdf' })
          .then((path) => setImagePath(path))
          .catch(() => {
            notification.error({ message: 'Failed to save PDF. Preview still shown.' })
          })
      }
      reader.readAsDataURL(file)
    } else {
      const objectUrl = URL.createObjectURL(file)
      previewObjectUrlRef.current = objectUrl
      setPreviewObjectUrl(objectUrl)
      const payload = { dataUrl: objectUrl, isPdf: false }
      previewDataUrlRef.current = payload
      setPreviewDataUrl(payload)
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = (reader.result as string) ?? ''
        if (!dataUrl) return
        const base64 = dataUrl.replace(/^data:\w+\/\w+;base64,/, '')
        const ext = file.type === 'image/png' ? 'png' : 'jpg'
        window.api
          .invoke<string>('prescriptions:saveImage', { base64, extension: ext })
          .then((path) => setImagePath(path))
          .catch(() => {
            notification.error({ message: 'Failed to save image. Preview still shown.' })
          })
      }
      reader.readAsDataURL(file)
    }
    return false
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Edit Prescription' : 'New Prescription'}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={() => void handleFinish(form.getFieldsValue())}>
        <Form.Item name="patient_name" label="Patient Name" rules={[{ required: true, message: 'Required.' }]}>
          <Input placeholder="Patient name" />
        </Form.Item>
        <Form.Item name="patient_age" label="Patient Age (optional)">
          <InputNumber min={1} max={150} style={{ width: '100%' }} placeholder="Age" onFocus={selectAllOnFocus} />
        </Form.Item>
        <Form.Item name="doctor_name" label="Doctor Name" rules={[{ required: true, message: 'Required.' }]}>
          <Input placeholder="Doctor name" />
        </Form.Item>
        <Form.Item name="prescription_date" label="Prescription Date" rules={[{ required: true, message: 'Required.' }]}>
          <DatePicker format={dateFormat} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="medicines_prescribed" label="Medicines prescribed">
          <Input.TextArea rows={4} placeholder="List medicines as prescribed by doctor" />
        </Form.Item>
        <Form.Item label="Prescription Image (optional)">
          <Upload
            fileList={fileList}
            beforeUpload={beforeUpload}
            onRemove={() => {
              if (previewObjectUrlRef.current) {
                URL.revokeObjectURL(previewObjectUrlRef.current)
                previewObjectUrlRef.current = null
              }
              setPreviewObjectUrl(null)
              previewDataUrlRef.current = null
              setFileList([])
              setImagePath(null)
              setPreviewDataUrl(null)
            }}
            accept=".jpg,.jpeg,.png,.pdf"
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>Upload JPG, PNG or PDF</Button>
          </Upload>
          {(fileList.length > 0 || previewDataUrl || previewDataUrlRef.current) && (
            <div style={{ marginTop: 12, border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden', maxHeight: 280 }}>
              <div style={{ padding: 8, background: '#fafafa', fontSize: 12, color: '#666' }}>
                <FileImageOutlined /> Uploaded prescription — you can view what you uploaded below
              </div>
              {(() => {
                const p = previewDataUrl ?? previewDataUrlRef.current
                if (!p) return <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Loading preview…</div>
                return p.isPdf ? (
                  <iframe
                    key="pdf-preview"
                    src={p.dataUrl}
                    title="Prescription PDF"
                    style={{ width: '100%', height: 260, border: 'none' }}
                  />
                ) : (
                  <img
                    key="img-preview"
                    src={p.dataUrl}
                    alt="Prescription preview"
                    style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block', minHeight: 120 }}
                  />
                )
              })()}
            </div>
          )}
        </Form.Item>
        <Form.Item name="bill_id" label="Link to Bill (optional)">
          <Select
            allowClear
            placeholder="— None —"
            options={[{ value: null, label: '— None —' }, ...recentBills.map((b) => ({ value: b.id, label: b.bill_number }))]}
          />
        </Form.Item>
        <Form.Item name="notes" label="Notes (optional)">
          <Input.TextArea rows={2} placeholder="Notes" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={saving}>
            {isEdit ? 'Update' : 'Add'} Prescription
          </Button>
          <Button style={{ marginLeft: 8 }} onClick={onClose}>
            Cancel
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
