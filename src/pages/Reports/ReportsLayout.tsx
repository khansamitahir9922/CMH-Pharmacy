import React from 'react'
import { Button } from 'antd'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'

export function ReportsLayout(): React.ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const isIndex = location.pathname === '/reports' || location.pathname === '/reports/'

  return (
    <div style={{ padding: 24 }}>
      {!isIndex && (
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/reports')}
          style={{ marginBottom: 16 }}
        >
          Back to Reports
        </Button>
      )}
      <Outlet />
    </div>
  )
}
