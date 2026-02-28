import React, { useState } from 'react'
import { Typography, Tabs } from 'antd'
import { ShopOutlined, UserOutlined, CloudOutlined, AuditOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { PharmacyProfileTab } from './PharmacyProfileTab'
import { UserManagementTab } from './UserManagementTab'
import { BackupRestoreTab } from './BackupRestoreTab'
import { AuditLogTab } from './AuditLogTab'

const { Title } = Typography

export function SettingsPage(): React.ReactElement {
  const { currentUser } = useAuthStore()
  const isAdmin = currentUser?.role === 'admin'
  const [activeKey, setActiveKey] = useState('profile')

  const items = [
    { key: 'profile', label: 'Pharmacy Profile', children: <PharmacyProfileTab />, icon: <ShopOutlined /> },
    ...(isAdmin
      ? [
          { key: 'users', label: 'User Management', children: <UserManagementTab />, icon: <UserOutlined /> },
          { key: 'backup', label: 'Backup & Restore', children: <BackupRestoreTab />, icon: <CloudOutlined /> },
          { key: 'audit', label: 'Audit Log', children: <AuditLogTab />, icon: <AuditOutlined /> }
        ]
      : [])
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        Settings
      </Title>
      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={items.map((item) => ({
          key: item.key,
          label: (
            <span>
              {item.icon}
              <span style={{ marginLeft: 8 }}>{item.label}</span>
            </span>
          ),
          children: item.children
        }))}
      />
    </div>
  )
}
