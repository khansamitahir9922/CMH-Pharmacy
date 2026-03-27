import React from 'react'
import { Typography, Card, Row, Col, Button } from 'antd'
import {
  BarChartOutlined,
  DatabaseOutlined,
  CalendarOutlined,
  WarningOutlined,
  ShoppingOutlined,
  MedicineBoxOutlined,
  DiffOutlined,
  AuditOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title } = Typography

const REPORT_CARDS = [
  {
    key: 'sales',
    path: '/reports/sales',
    icon: <BarChartOutlined style={{ fontSize: 28, color: '#1890ff' }} />,
    title: 'Daily/Monthly Report',
    description: 'View sales summary, revenue, and bill details by date range with export options.'
  },
  {
    key: 'stock',
    path: '/reports/stock',
    icon: <DatabaseOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
    title: 'Stock Balance Report',
    description: 'As-of-date stock with opening, issued, received, and closing quantities by medicine.'
  },
  {
    key: 'expiry',
    path: '/reports/expiry',
    icon: <CalendarOutlined style={{ fontSize: 28, color: '#fa8c16' }} />,
    title: 'Expiry Report',
    description: 'Medicines expiring soon or expired, with export to Excel and PDF.'
  },
  {
    key: 'low-stock',
    path: '/reports/low-stock',
    icon: <WarningOutlined style={{ fontSize: 28, color: '#faad14' }} />,
    title: 'Low Stock Report',
    description: 'Medicines below minimum stock level with export options.'
  },
  {
    key: 'purchase',
    path: '/reports/purchase',
    icon: <ShoppingOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
    title: 'Purchase & Supply Report',
    description: 'Purchase orders by date range and supplier with outstanding balance.'
  },
  {
    key: 'issue',
    path: '/reports/issue',
    icon: <MedicineBoxOutlined style={{ fontSize: 28, color: '#eb2f96' }} />,
    title: 'Medicine Issue Report',
    description: 'Stock issued (sales and manual) by date range and medicine.'
  },
  {
    key: 'stock-variance',
    path: '/reports/stock-variance',
    icon: <DiffOutlined style={{ fontSize: 28, color: '#13c2c2' }} />,
    title: 'Stock Variance Report',
    description: 'Received vs issued by medicine in a date range; variance = received − issued.'
  },
  {
    key: 'near-expiry',
    path: '/reports/near-expiry',
    icon: <CalendarOutlined style={{ fontSize: 28, color: '#fa541c' }} />,
    title: 'Near-expiry Alert Report',
    description: 'Medicines expiring soon or expired (same as Expiry Report).'
  },
  {
    key: 'adjustment-log',
    path: '/reports/adjustment-log',
    icon: <AuditOutlined style={{ fontSize: 28, color: '#2f54eb' }} />,
    title: 'Adjustment Log Report',
    description: 'Stock adjustments with date range and user filter; logged in audit.'
  },
  {
    key: 'purchase-vs-consumption',
    path: '/reports/purchase-vs-consumption',
    icon: <LineChartOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
    title: 'Purchase vs Consumption Analysis',
    description: 'Purchase (from POs) vs consumption (stock out) by medicine in a period.'
  },
  {
    key: 'controlled-drug-register',
    path: '/reports/controlled-drug-register',
    icon: <SafetyCertificateOutlined style={{ fontSize: 28, color: '#cf1322' }} />,
    title: 'Controlled Drug Register Summary',
    description: 'List of medicines marked as controlled with current stock.'
  }
]

export function ReportsPage(): React.ReactElement {
  const navigate = useNavigate()

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        Reports
      </Title>
      <Row gutter={[16, 16]}>
        {REPORT_CARDS.map((r) => (
          <Col xs={24} md={12} key={r.key}>
            <Card
              hoverable
              onClick={() => navigate(r.path)}
              style={{ height: '100%' }}
              styles={{ body: { padding: 20 } }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span>{r.icon}</span>
                  <div style={{ flex: 1 }}>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      {r.title}
                    </Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {r.description}
                    </Typography.Text>
                  </div>
                </div>
                <Button type="primary" onClick={(e) => { e.stopPropagation(); navigate(r.path) }}>
                  Generate
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
