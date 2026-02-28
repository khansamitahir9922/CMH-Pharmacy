import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AutoComplete, Button, Divider, Empty, Input, InputNumber, Radio, Space, Table, Typography, notification } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/utils/expiryStatus'
import { BillReceiptModal, type ReceiptData } from './BillReceiptModal'
import { useNavigate } from 'react-router-dom'

type PaymentMode = 'cash' | 'card' | 'credit'

interface MedicineSearchRow {
  id: number
  name: string
  batch_no: string | null
  current_quantity: number
  unit_price_sell: number
}

interface BillLineItem {
  medicineId: number
  name: string
  batchNo: string | null
  stock: number
  qty: number
  unitPrice: number
}

function toInt(n: unknown, fallback = 0): number {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? Math.trunc(v) : fallback
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

export function POSPage(): React.ReactElement {
  const { currentUser } = useAuthStore()
  const navigate = useNavigate()

  const [searchText, setSearchText] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<MedicineSearchRow[]>([])
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<Input | null>(null)

  const [items, setItems] = useState<BillLineItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  const [discountPercent, setDiscountPercent] = useState(0)
  const [taxPercent, setTaxPercent] = useState(0)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')
  const [amountReceived, setAmountReceived] = useState(0)

  const [generating, setGenerating] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  const [tableY, setTableY] = useState(260)
  const tableWrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    searchInputRef.current?.focus()
    window.api.invoke<string | null>('settings:get', 'gst_percent')
      .then((v) => {
        const pct = clampInt(toInt(v ?? 0), 0, 100)
        setTaxPercent(pct)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!tableWrapRef.current) return
    const el = tableWrapRef.current
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height ?? 0
      setTableY(Math.max(160, Math.floor(h - 8)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const subtotal = useMemo(() => items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0), [items])
  const discountAmount = useMemo(() => Math.round((subtotal * clampInt(discountPercent, 0, 100)) / 100), [subtotal, discountPercent])
  const taxable = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount])
  const taxAmount = useMemo(() => Math.round((taxable * clampInt(taxPercent, 0, 100)) / 100), [taxable, taxPercent])
  const total = useMemo(() => taxable + taxAmount, [taxable, taxAmount])
  const changeDue = useMemo(() => (paymentMode === 'cash' ? amountReceived - total : 0), [amountReceived, total, paymentMode])

  useEffect(() => {
    // keyboard shortcuts
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'F2') {
        e.preventDefault()
        handleClear()
        return
      }
      if (e.key === 'F8') {
        e.preventDefault()
        void handleGenerateBill()
        return
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        // print last receipt if available
        if (receiptData) {
          e.preventDefault()
          window.print()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptData, total, paymentMode, amountReceived, items, discountPercent, taxPercent, customerName, customerPhone])

  const fetchSearch = (term: string): void => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    const t = term
    searchDebounceRef.current = setTimeout(() => {
      window.api.invoke<MedicineSearchRow[]>('medicines:search', t)
        .then((res) => {
          const list = (res ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            batch_no: r.batch_no ?? null,
            current_quantity: r.current_quantity ?? 0,
            unit_price_sell: r.unit_price_sell ?? 0
          }))
          setSearchResults(list)
          setDropdownOpen(list.length > 0)
        })
        .catch(() => {
          setSearchResults([])
          setDropdownOpen(false)
        })
    }, 150)
  }

  const handleAddMedicine = (m: MedicineSearchRow): void => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.medicineId === m.id)
      if (idx >= 0) {
        const next = [...prev]
        const existing = next[idx]
        const newQty = existing.qty + 1
        next[idx] = { ...existing, qty: newQty }
        return next
      }
      return [
        ...prev,
        {
          medicineId: m.id,
          name: m.name,
          batchNo: m.batch_no ?? null,
          stock: m.current_quantity ?? 0,
          qty: 1,
          unitPrice: m.unit_price_sell ?? 0
        }
      ]
    })
    setSearchText('')
    setSearchResults([])
    setDropdownOpen(false)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const handleQtyChange = (medicineId: number, qty: number | null): void => {
    const q = qty == null ? 1 : clampInt(qty, 1, 999999)
    setItems((prev) => prev.map((it) => (it.medicineId === medicineId ? { ...it, qty: q } : it)))
  }

  const handleRemove = (medicineId: number): void => {
    setItems((prev) => prev.filter((it) => it.medicineId !== medicineId))
  }

  const handleClear = (): void => {
    setItems([])
    setCustomerName('')
    setCustomerPhone('')
    setDiscountPercent(0)
    setPaymentMode('cash')
    setAmountReceived(0)
    setReceiptData(null)
    setReceiptOpen(false)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const handleGenerateBill = async (): Promise<void> => {
    if (generating) return
    if (!items.length) {
      notification.warning({ message: 'No items', description: 'Search for medicines above to add them to this bill.' })
      return
    }
    if (paymentMode === 'cash' && amountReceived < total) {
      notification.error({ message: 'Cash received is insufficient', description: 'Amount received must be greater than or equal to total.' })
      return
    }

    setGenerating(true)
    try {
      const payload = {
        customer: {
          name: customerName.trim() ? customerName.trim() : null,
          phone: customerPhone.trim() ? customerPhone.trim() : null
        },
        items: items.map((it) => ({ medicineId: it.medicineId, quantity: it.qty, unitPrice: it.unitPrice })),
        discount: { percent: clampInt(discountPercent, 0, 100) },
        tax: { percent: clampInt(taxPercent, 0, 100) },
        paymentMode,
        received: paymentMode === 'cash' ? toInt(amountReceived) : null,
        createdBy: currentUser?.id ?? null
      }

      const res = await window.api.invoke<ReceiptData>('billing:createBill', payload)
      if (!res?.bill) throw new Error('Failed to generate bill.')
      setReceiptData(res)
      setReceiptOpen(true)
      notification.success({ message: 'Bill generated', description: `${res.bill.bill_number} created successfully.` })
    } catch (err) {
      notification.error({
        message: 'Failed to generate bill',
        description: err instanceof Error ? err.message : 'Unknown error'
      })
    } finally {
      setGenerating(false)
    }
  }

  const columns: ColumnsType<BillLineItem & { idx: number }> = [
    { title: '#', key: 'idx', width: 44, render: (_, r) => r.idx + 1 },
    {
      title: 'Medicine Name',
      key: 'name',
      render: (_, r) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: '#111827' }}>{r.name}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            Batch: {r.batchNo ?? '—'} | Stock: {r.stock}
          </div>
        </div>
      )
    },
    {
      title: 'Qty',
      key: 'qty',
      width: 96,
      render: (_, r) => (
        <InputNumber
          min={1}
          max={999999}
          value={r.qty}
          onChange={(v) => handleQtyChange(r.medicineId, v)}
          style={{ width: '100%' }}
        />
      )
    },
    { title: 'Unit Price', key: 'unitPrice', width: 110, render: (_, r) => formatCurrency(r.unitPrice) },
    { title: 'Total', key: 'total', width: 110, render: (_, r) => formatCurrency(r.qty * r.unitPrice) },
    {
      title: '',
      key: 'remove',
      width: 52,
      render: (_, r) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemove(r.medicineId)}
          aria-label="Remove"
        />
      )
    }
  ]

  const options = useMemo(() => {
    return searchResults.map((m) => ({
      value: String(m.id),
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.name}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              Batch: {m.batch_no ?? '—'} | Stock: {m.current_quantity ?? 0}
            </div>
          </div>
          <div style={{ fontWeight: 700, color: '#1A56DB', whiteSpace: 'nowrap' }}>
            {formatCurrency(m.unit_price_sell ?? 0)}
          </div>
        </div>
      )
    }))
  }, [searchResults])

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        gap: 16,
        overflow: 'hidden'
      }}
    >
      {/* LEFT */}
      <div style={{ flex: 3, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AutoComplete
          style={{ width: '100%' }}
          options={options}
          value={searchText}
          open={dropdownOpen}
          onDropdownVisibleChange={(v) => setDropdownOpen(v)}
          onSelect={(value) => {
            const id = toInt(value)
            const m = searchResults.find((r) => r.id === id)
            if (m) handleAddMedicine(m)
          }}
          onChange={(v) => {
            const next = String(v ?? '')
            setSearchText(next)
            if (!next.trim()) {
              setSearchResults([])
              setDropdownOpen(false)
              return
            }
            fetchSearch(next)
          }}
        >
          <Input
            ref={searchInputRef}
            size="large"
            placeholder="Search medicine by name or scan barcode..."
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDropdownOpen(false)
                return
              }
              if (e.key === 'Enter') {
                const first = searchResults[0]
                if (first) {
                  e.preventDefault()
                  handleAddMedicine(first)
                  return
                }
                const term = searchText.trim()
                if (term) {
                  e.preventDefault()
                  window.api.invoke<MedicineSearchRow[]>('medicines:search', term).then((res) => {
                    const list = (res ?? []).map((r) => ({
                      id: r.id,
                      name: r.name,
                      batch_no: r.batch_no ?? null,
                      current_quantity: r.current_quantity ?? 0,
                      unit_price_sell: r.unit_price_sell ?? 0
                    }))
                    if (list.length === 1) {
                      handleAddMedicine(list[0])
                    } else if (list.length > 1) {
                      setSearchResults(list)
                      setDropdownOpen(true)
                    }
                  }).catch(() => {})
                }
              }
            }}
          />
        </AutoComplete>

        <Divider style={{ margin: '12px 0' }} />

        <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {items.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty description="Search for medicines above to add them to this bill" />
            </div>
          ) : (
            <Table
              size="small"
              rowKey={(r) => `${r.medicineId}`}
              columns={columns}
              dataSource={items.map((it, idx) => ({ ...it, idx }))}
              pagination={false}
              scroll={{ y: tableY }}
            />
          )}
        </div>
      </div>

      {/* RIGHT */}
      <div
        style={{
          flex: 2,
          minWidth: 360,
          maxWidth: 520,
          borderLeft: '1px solid rgba(0,0,0,0.06)',
          paddingLeft: 16,
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            POS Billing
          </Typography.Title>
          <Button onClick={() => navigate('/billing/history')}>Bill History</Button>
        </div>

        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
          Customer
        </Typography.Title>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer Name (optional)" />
          <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Customer Phone (optional)" />
        </Space>

        <Divider style={{ margin: '14px 0' }} />

        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
          Bill Summary
        </Typography.Title>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8, columnGap: 12, fontSize: 13 }}>
          <div>Subtotal</div>
          <div style={{ fontWeight: 700 }}>{formatCurrency(subtotal)}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Discount %</span>
          </div>
          <InputNumber min={0} max={100} value={discountPercent} onChange={(v) => setDiscountPercent(clampInt(toInt(v ?? 0), 0, 100))} style={{ width: 120 }} />

          <div>Discount Amount</div>
          <div style={{ fontWeight: 700 }}>-{formatCurrency(discountAmount)}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Tax %</span>
          </div>
          <InputNumber min={0} max={100} value={taxPercent} onChange={(v) => setTaxPercent(clampInt(toInt(v ?? 0), 0, 100))} style={{ width: 120 }} />

          <div>Tax Amount</div>
          <div style={{ fontWeight: 700 }}>{formatCurrency(taxAmount)}</div>

          <div style={{ fontWeight: 800, color: '#1A56DB', fontSize: 14 }}>TOTAL</div>
          <div style={{ fontWeight: 900, color: '#1A56DB', fontSize: 18 }}>{formatCurrency(total)}</div>
        </div>

        <Divider style={{ margin: '14px 0' }} />

        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
          Payment
        </Typography.Title>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Radio.Group
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="cash">Cash</Radio.Button>
            <Radio.Button value="card">Card</Radio.Button>
            <Radio.Button value="credit">Credit</Radio.Button>
          </Radio.Group>

          {paymentMode === 'cash' ? (
            <>
              <InputNumber
                min={0}
                step={0.01}
                value={amountReceived / 100}
                onChange={(v) => setAmountReceived(Math.round((Number(v) || 0) * 100))}
                style={{ width: '100%' }}
                placeholder="Amount Received (Rs.)"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Change Due</span>
                <span style={{ fontWeight: 800, color: changeDue >= 0 ? '#059669' : '#DC2626' }}>
                  {formatCurrency(Math.max(0, changeDue))}
                </span>
              </div>
            </>
          ) : null}
        </Space>

        <Divider style={{ margin: '14px 0' }} />

        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Button
            type="primary"
            size="large"
            block
            style={{ background: '#059669' }}
            icon={<ThunderboltOutlined />}
            loading={generating}
            onClick={() => { void handleGenerateBill() }}
          >
            Generate Bill
          </Button>
          <Button size="large" block onClick={handleClear}>
            Clear
          </Button>
        </Space>

        <Divider style={{ margin: '14px 0' }} />

        <div style={{ fontSize: 12, color: '#6B7280' }}>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 6 }}>Keyboard Shortcuts</div>
          <div>F2 = New Bill</div>
          <div>F8 = Generate Bill</div>
          <div>Ctrl+P = Print last bill</div>
          <div style={{ marginTop: 8, color: '#9CA3AF' }}>Date: {dayjs().format('DD/MM/YYYY')}</div>
        </div>
      </div>

      <BillReceiptModal
        open={receiptOpen}
        data={receiptData}
        onNewBill={() => {
          setReceiptOpen(false)
          setReceiptData(null)
          handleClear()
        }}
        onClose={() => setReceiptOpen(false)}
      />
    </div>
  )
}

