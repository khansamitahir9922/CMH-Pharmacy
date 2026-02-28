import React, { useState, useEffect } from 'react'
import { Modal, List, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

interface StartupAlertModalProps {
  visible: boolean
  onClose: () => void
  expiredCount: number
  lowStockCount: number
}

export function StartupAlertModal({
  visible,
  onClose,
  expiredCount,
  lowStockCount
}: StartupAlertModalProps): React.ReactElement {
  const navigate = useNavigate()
  const [issues, setIssues] = useState<{ type: string; name: string }[]>([])

  useEffect(() => {
    if (!visible || (expiredCount === 0 && lowStockCount === 0)) return
    const load = (): void => {
      Promise.all([
        window.api.invoke<{ expired: { name: string }[] }>('inventory:getExpiryReport'),
        window.api.invoke<{ name: string }[]>('inventory:getLowStock', 5)
      ])
        .then(([expiry, lowStock]) => {
          const list: { type: string; name: string }[] = []
          const exp = expiry?.expired ?? []
          exp.slice(0, 5).forEach((e) => list.push({ type: 'Expired', name: e.name }))
          const low = lowStock ?? []
          low.slice(0, 5).forEach((e) => list.push({ type: 'Low stock', name: e.name }))
          setIssues(list.slice(0, 5))
        })
        .catch(() => setIssues([]))
    }
    load()
  }, [visible, expiredCount, lowStockCount])

  const handleViewInventory = (): void => {
    onClose()
    navigate('/inventory')
  }

  const hasAlerts = expiredCount > 0 || lowStockCount > 0

  return (
    <Modal
      title="Inventory alerts"
      open={visible && hasAlerts}
      onCancel={onClose}
      onOk={handleViewInventory}
      okText="View Inventory"
      cancelText="Dismiss"
    >
      <Typography.Paragraph>
        {expiredCount > 0 && (
          <span>You have {expiredCount} expired medicine(s). </span>
        )}
        {lowStockCount > 0 && (
          <span>You have {lowStockCount} low stock item(s). </span>
        )}
      </Typography.Paragraph>
      {issues.length > 0 && (
        <List
          size="small"
          dataSource={issues}
          renderItem={(item) => (
            <List.Item>
              <span style={{ color: item.type === 'Expired' ? '#dc2626' : '#d97706' }}>[{item.type}]</span> {item.name}
            </List.Item>
          )}
        />
      )}
    </Modal>
  )
}
