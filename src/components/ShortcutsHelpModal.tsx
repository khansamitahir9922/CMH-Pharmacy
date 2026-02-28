import React, { useState } from 'react'
import { Button, Modal, Table } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Click menu', action: 'Navigate to Dashboard, Medicines, Inventory, etc.' },
  { keys: 'Ctrl + R', action: 'Refresh (on Dashboard)' },
  { keys: 'Esc', action: 'Close modal / cancel' },
  { keys: 'Enter', action: 'Submit form / confirm (in modals)' }
]

export function ShortcutsHelpModal(): React.ReactElement {
  const [open, setOpen] = useState(false)

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
        title="Keyboard shortcuts"
      >
        ?
      </Button>
      <Modal
        title="Keyboard shortcuts"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={520}
      >
        <Table
          dataSource={SHORTCUTS}
          rowKey="keys"
          pagination={false}
          size="small"
          columns={[
            { title: 'Shortcut', dataIndex: 'keys', key: 'keys', width: 160, render: (k) => <kbd style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: 4 }}>{k}</kbd> },
            { title: 'Action', dataIndex: 'action', key: 'action' }
          ]}
        />
      </Modal>
    </>
  )
}
