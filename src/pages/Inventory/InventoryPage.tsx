import React from 'react'
import { Tabs, Typography } from 'antd'
import { DashboardOutlined, UnorderedListOutlined, FileTextOutlined } from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'

const tabs = [
  { key: '/inventory', label: 'Dashboard', icon: <DashboardOutlined /> },
  { key: '/inventory/transactions', label: 'Stock Transactions', icon: <UnorderedListOutlined /> },
  { key: '/inventory/expiry', label: 'Expiry Report', icon: <FileTextOutlined /> }
]

export function InventoryPage(): React.ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const activeKey = tabs.some((t) => t.key === location.pathname) ? location.pathname : '/inventory'

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        Inventory Management
      </Typography.Title>
      <Tabs
        activeKey={activeKey}
        onChange={(key) => navigate(key)}
        items={tabs.map((t) => ({ key: t.key, label: t.label, children: null }))}
      />
      <Outlet />
    </div>
  )
}
