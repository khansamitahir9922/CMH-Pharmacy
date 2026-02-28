import React from 'react'
import { Tabs } from 'antd'
import { TeamOutlined, ShoppingOutlined } from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'

const tabs = [
  { key: '/suppliers', label: 'Suppliers', icon: <TeamOutlined /> },
  { key: '/suppliers/orders', label: 'Purchase Orders', icon: <ShoppingOutlined /> }
]

export function SuppliersPage(): React.ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const activeKey = location.pathname.startsWith('/suppliers/orders') ? '/suppliers/orders' : '/suppliers'

  return (
    <div>
      <Tabs
        activeKey={activeKey}
        onChange={(key) => navigate(key)}
        items={tabs.map((t) => ({ key: t.key, label: t.label, children: null }))}
      />
      <Outlet />
    </div>
  )
}
