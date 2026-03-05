import React, { useState, useEffect } from 'react'
import { Button, Modal, Table, Typography } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: '?', action: 'Open this shortcuts help' },
  { keys: 'Click menu', action: 'Navigate to Dashboard, Medicines, Inventory, etc.' },
  { keys: 'Ctrl + R', action: 'Refresh (on Dashboard)' },
  { keys: 'Esc', action: 'Close modal / cancel' },
  { keys: 'Enter', action: 'Submit form / confirm (in modals)' },
  { keys: 'F2', action: 'Clear current bill (Billing / POS)' },
  { keys: 'F8', action: 'Complete bill and print receipt (Billing / POS)' },
  { keys: 'Ctrl + P', action: 'Print last receipt (when receipt is open)' }
]

export function ShortcutsHelpModal(): React.ReactElement {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      e.preventDefault()
      setOpen((o) => !o)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <Button
        type="text"
        icon={<QuestionCircleOutlined />}
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          width: 40,
          height: 40,
          borderRadius: '50%',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
        title="Keyboard shortcuts (or press ?)"
      >
        ?
      </Button>
      <Modal
        title="Keyboard shortcuts"
        open={open}
        onCancel={() => setOpen(false)}
        footer={
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Press ? anytime (when not typing) to open this help.
          </Typography.Text>
        }
        width={520}
      >
        <Table
          dataSource={SHORTCUTS}
          rowKey="keys"
          pagination={false}
          size="small"
          columns={[
            { title: 'Shortcut', dataIndex: 'keys', key: 'keys', width: 180, render: (k) => <kbd style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: 4 }}>{k}</kbd> },
            { title: 'Action', dataIndex: 'action', key: 'action' }
          ]}
        />
      </Modal>
    </>
  )
}
