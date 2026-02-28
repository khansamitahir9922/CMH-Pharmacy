import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Divider, Typography, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { formatCurrency } from '@/utils/expiryStatus'

export type PaymentMode = 'cash' | 'card' | 'credit'

export interface ReceiptBill {
  id: number
  bill_number: string
  customer_name: string | null
  customer_phone: string | null
  subtotal: number
  discount_percent: number
  tax_percent: number
  total_amount: number
  payment_mode: PaymentMode
  amount_received: number
  change_due: number
  created_at: string
  is_voided?: boolean
  voided_reason?: string | null
}

export interface ReceiptItem {
  medicine_id: number
  medicine_name: string | null
  quantity: number
  unit_price: number
  total: number
}

export interface ReceiptData {
  bill: ReceiptBill
  items: ReceiptItem[]
}

export function BillReceiptModal(props: {
  open: boolean
  data: ReceiptData | null
  onNewBill?: () => void
  onClose: () => void
}): React.ReactElement {
  const { open, data, onNewBill, onClose } = props
  const bill = data?.bill ?? null
  const items = data?.items ?? []

  const [pharmacyName, setPharmacyName] = useState('SKBZ/CMH RAWALAKOT PHARMACY')
  const [pharmacyAddress, setPharmacyAddress] = useState('')
  const [pharmacyPhone, setPharmacyPhone] = useState('')

  useEffect(() => {
    if (!open) return
    window.api.invoke<Record<string, string | null>>('settings:getAll')
      .then((all) => {
        const name = all?.pharmacy_name ?? null
        const address = all?.pharmacy_address ?? null
        const phone = all?.pharmacy_phone ?? null
        if (name?.trim()) setPharmacyName(name.trim())
        setPharmacyAddress(address?.trim() ? address.trim() : '')
        setPharmacyPhone(phone?.trim() ? phone.trim() : '')
      })
      .catch(() => {})
  }, [open])

  const discountAmount = useMemo(() => {
    if (!bill) return 0
    return Math.round((bill.subtotal * (bill.discount_percent ?? 0)) / 100)
  }, [bill])

  const taxAmount = useMemo(() => {
    if (!bill) return 0
    const taxable = Math.max(0, bill.subtotal - discountAmount)
    return Math.round((taxable * (bill.tax_percent ?? 0)) / 100)
  }, [bill, discountAmount])

  const columns: ColumnsType<ReceiptItem> = [
    { title: 'Name', dataIndex: 'medicine_name', key: 'medicine_name', render: (v) => v ?? '—' },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 56 },
    { title: 'Price', dataIndex: 'unit_price', key: 'unit_price', width: 90, render: (v) => formatCurrency(v ?? 0) },
    { title: 'Total', dataIndex: 'total', key: 'total', width: 90, render: (v) => formatCurrency(v ?? 0) }
  ]

  const handlePrint = (): void => {
    window.print()
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={
        <div className="no-print" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={handlePrint}>Print Receipt</Button>
          {onNewBill ? <Button type="primary" onClick={onNewBill}>New Bill</Button> : null}
          <Button onClick={onClose}>Close</Button>
        </div>
      }
      width={520}
      title="Receipt"
      destroyOnClose
    >
      <style>{`
        @page {
          size: 80mm auto;
          margin: 4mm;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #receipt-print, #receipt-print * {
            visibility: visible !important;
          }
          #receipt-print {
            position: fixed;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div id="receipt-print" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial" }}>
        <div style={{ textAlign: 'center' }}>
          <Typography.Title level={5} style={{ margin: 0, fontWeight: 800 }}>
            {pharmacyName}
          </Typography.Title>
          {pharmacyAddress ? (
            <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>{pharmacyAddress}</div>
          ) : null}
          {pharmacyPhone ? (
            <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{pharmacyPhone}</div>
          ) : null}
        </div>

        <Divider style={{ margin: '10px 0' }} />

        <div style={{ textAlign: 'center', fontWeight: 800, letterSpacing: 1 }}>RECEIPT</div>

        <div style={{ marginTop: 8, fontSize: 12, color: '#111827' }}>
          <div><strong>Bill No:</strong> {bill?.bill_number ?? '—'}</div>
          <div><strong>Date/Time:</strong> {bill ? dayjs(bill.created_at).format('DD/MM/YYYY HH:mm') : '—'}</div>
          {bill?.customer_name?.trim() ? (
            <div><strong>Customer:</strong> {bill.customer_name}</div>
          ) : null}
          {bill?.customer_phone?.trim() ? (
            <div><strong>Phone:</strong> {bill.customer_phone}</div>
          ) : null}
        </div>

        <Divider style={{ margin: '10px 0' }} />

        <Table
          size="small"
          rowKey={(r) => `${r.medicine_id}`}
          columns={columns}
          dataSource={items}
          pagination={false}
        />

        <Divider style={{ margin: '10px 0' }} />

        <div style={{ fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span>
            <strong>{formatCurrency(bill?.subtotal ?? 0)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Discount ({bill?.discount_percent ?? 0}%)</span>
            <strong>-{formatCurrency(discountAmount)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tax ({bill?.tax_percent ?? 0}%)</span>
            <strong>{formatCurrency(taxAmount)}</strong>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ fontWeight: 800, color: '#1A56DB' }}>TOTAL</span>
            <span style={{ fontWeight: 900, color: '#1A56DB' }}>{formatCurrency(bill?.total_amount ?? 0)}</span>
          </div>
        </div>

        <Divider style={{ margin: '10px 0' }} />

        <div style={{ fontSize: 12 }}>
          <div><strong>Payment:</strong> {(bill?.payment_mode ?? 'cash').toUpperCase()}</div>
          {bill?.payment_mode === 'cash' ? (
            <>
              <div><strong>Received:</strong> {formatCurrency(bill.amount_received ?? 0)}</div>
              <div><strong>Change Due:</strong> {formatCurrency(bill.change_due ?? 0)}</div>
            </>
          ) : null}
        </div>

        {bill?.is_voided ? (
          <div style={{ marginTop: 10, fontSize: 12, color: '#DC2626', fontWeight: 700 }}>
            VOIDED{bill.voided_reason ? ` — ${bill.voided_reason}` : ''}
          </div>
        ) : null}

        <Divider style={{ margin: '10px 0' }} />
        <div style={{ textAlign: 'center', fontSize: 12, color: '#374151' }}>
          Thank you for your visit!
        </div>
      </div>
    </Modal>
  )
}

