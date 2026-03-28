import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { Layout, Menu, Dropdown, Modal, theme, Badge, Spin, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined,
  MedicineBoxOutlined,
  InboxOutlined,
  TeamOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAlertStore, type InventorySummaryCounts } from '@/store/alertStore'
import { StartupAlertModal } from '@/components/StartupAlertModal'
import { ShortcutsHelpModal } from '@/components/ShortcutsHelpModal'

const { Header, Sider, Content, Footer } = Layout
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const ALERT_POLL_MS = 5 * 60 * 1000 // 5 minutes

const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
const LOGO_PATH = `${BASE}logo.png`

export function AppLayout(): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false)
  const [startupAlertShown, setStartupAlertShown] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, logout } = useAuthStore()
  const { summary, setSummary } = useAlertStore()
  const { token } = theme.useToken()
  const isPOS = location.pathname.startsWith('/billing/pos')

  useEffect(() => {
    const fetchSummary = (): void => {
      window.api.invoke<InventorySummaryCounts>('inventory:getSummary').then((s) => {
        if (s) setSummary(s)
      }).catch(() => {})
    }
    fetchSummary()
    const interval = setInterval(fetchSummary, ALERT_POLL_MS)
    return () => clearInterval(interval)
  }, [setSummary])

  const menuLabelColor = { color: 'rgba(255, 255, 255, 0.92)' }
  const tooltipProps = { placement: 'right' as const, mouseEnterDelay: 0.4 }
  const labelWrap = { display: 'block', minWidth: 0, width: '100%' as const }
  const siderMenuItems: MenuProps['items'] = useMemo(() => [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: (
        <Tooltip title="Overview: today's sales, bills, stock. Quick actions: New Bill, Add Medicine, Stock In." {...tooltipProps}>
          <span style={{ ...menuLabelColor, ...labelWrap }}>Dashboard</span>
        </Tooltip>
      )
    },
    {
      key: '/medicines',
      icon: <MedicineBoxOutlined />,
      label: (
        <Tooltip title="Manage medicine catalog: add, edit, delete medicines. Search by name or barcode. Filter by category and stock." {...tooltipProps}>
          <span style={labelWrap}>
            {summary.expired > 0 ? <Badge count={summary.expired} size="small"><span style={menuLabelColor}>Medicines</span></Badge> : <span style={menuLabelColor}>Medicines</span>}
          </span>
        </Tooltip>
      )
    },
    {
      key: '/inventory',
      icon: <InboxOutlined />,
      label: (
        <Tooltip title="Stock in, stock out, adjustments. View stock transactions, low stock alerts, and expiry report." {...tooltipProps}>
          <span style={labelWrap}>
            {summary.lowStock > 0 ? <Badge count={summary.lowStock} size="small"><span style={menuLabelColor}>Inventory</span></Badge> : <span style={menuLabelColor}>Inventory</span>}
          </span>
        </Tooltip>
      )
    },
    {
      key: '/suppliers',
      icon: <TeamOutlined />,
      label: (
        <Tooltip title="Manage suppliers, create purchase orders, and record payments." {...tooltipProps}>
          <span style={{ ...menuLabelColor, ...labelWrap }}>Suppliers</span>
        </Tooltip>
      )
    },
    {
      key: '/billing/pos',
      icon: <ShoppingCartOutlined />,
      label: (
        <Tooltip title="Point of sale: search medicines, add to bill, apply discount/tax, complete sale and print receipt." {...tooltipProps}>
          <span style={{ ...menuLabelColor, ...labelWrap }}>Billing</span>
        </Tooltip>
      )
    },
    {
      key: '/prescriptions',
      icon: <FileTextOutlined />,
      label: (
        <Tooltip title="Add and view prescriptions. Link prescriptions to bills. Upload prescription images." {...tooltipProps}>
          <span style={{ ...menuLabelColor, ...labelWrap }}>Prescriptions</span>
        </Tooltip>
      )
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: (
        <Tooltip title="Sales, stock, purchase, expiry and other reports. Export to Excel or print." {...tooltipProps}>
          <span style={{ ...menuLabelColor, ...labelWrap }}>Reports</span>
        </Tooltip>
      )
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: (
        <Tooltip title="Pharmacy profile, users, backup & restore, audit log." {...tooltipProps}>
          <span style={{ ...menuLabelColor, ...labelWrap }}>Settings</span>
        </Tooltip>
      )
    }
  ], [summary.expired, summary.lowStock])

  const resetSessionTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    timeoutRef.current = setTimeout(() => {
      setSessionExpiredOpen(true)
    }, SESSION_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    resetSessionTimer()
    const onActivity = () => resetSessionTimer()
    window.addEventListener('mousemove', onActivity)
    window.addEventListener('keydown', onActivity)
    return () => {
      window.removeEventListener('mousemove', onActivity)
      window.removeEventListener('keydown', onActivity)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [resetSessionTimer])

  const handleSessionExpiredClose = (): void => {
    setSessionExpiredOpen(false)
    window.api.invoke('auth:logout', { userId: currentUser?.id }).catch(() => {})
    logout()
    navigate('/login', { replace: true })
  }

  const handleLogout = (): void => {
    window.api.invoke('auth:logout', { userId: currentUser?.id }).catch(() => {})
    logout()
    navigate('/login', { replace: true })
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'signout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: handleLogout
    }
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Modal
        open={sessionExpiredOpen}
        closable={false}
        title="Session expired"
        onOk={handleSessionExpiredClose}
        onCancel={handleSessionExpiredClose}
        okText="Sign in again"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <p>Your session has expired. Please sign in again.</p>
      </Modal>

      <StartupAlertModal
        visible={!startupAlertShown && (summary.expired > 0 || summary.lowStock > 0)}
        onClose={() => setStartupAlertShown(true)}
        expiredCount={summary.expired}
        lowStockCount={summary.lowStock}
      />

      <Sider
        className="app-sider"
        width={240}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0
        }}
      >
        <div
          style={{
            minHeight: 64,
            padding: '12px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          {!logoError ? (
            <img
              src={LOGO_PATH}
              alt="Pharmacy"
              style={{ width: collapsed ? 32 : 40, height: collapsed ? 32 : 40, objectFit: 'contain', flexShrink: 0 }}
              onError={() => setLogoError(true)}
            />
          ) : (
            <MedicineBoxOutlined style={{ fontSize: collapsed ? 24 : 28, color: '#fff', flexShrink: 0 }} />
          )}
          {!collapsed && (
            <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>
                SKBZ/CMH
              </div>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                RAWALAKOT PHARMACY
              </div>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[
            location.pathname.startsWith('/inventory')
              ? '/inventory'
              : location.pathname.startsWith('/suppliers')
                ? '/suppliers'
                : location.pathname.startsWith('/billing')
                  ? '/billing/pos'
                  : location.pathname
          ]}
          items={siderMenuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8 }}
        />
        <style>{`
          .app-sider .ant-menu-dark .ant-menu-item:not(.ant-menu-item-selected),
          .app-sider .ant-menu-dark .ant-menu-submenu-title {
            color: rgba(255, 255, 255, 0.92);
          }
          .app-sider .ant-menu-dark .ant-menu-item .ant-badge,
          .app-sider .ant-menu-dark .ant-menu-item .ant-badge span {
            color: inherit;
          }
          .app-sider .ant-menu-dark .ant-menu-item:not(.ant-menu-item-selected):hover,
          .app-sider .ant-menu-dark .ant-menu-submenu-title:hover {
            color: #fff;
          }
          .app-sider .ant-menu-dark .ant-menu-item-selected .ant-badge span {
            color: #fff;
          }
        `}</style>
      </Sider>

      <Layout
        style={{
          marginLeft: collapsed ? 80 : 240,
          transition: 'margin-left 0.2s'
        }}
      >
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}
        >
          <div style={{ width: 260, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {!logoError ? (
                <img
                  src={LOGO_PATH}
                  alt=""
                  style={{ height: 42, width: 'auto', objectFit: 'contain' }}
                  onError={() => setLogoError(true)}
                />
              ) : (
                <MedicineBoxOutlined style={{ fontSize: 30, color: token.colorPrimary }} />
              )}
              <h2 style={{ margin: 0, color: token.colorText, fontWeight: 700, fontSize: 22, letterSpacing: '0.02em' }}>
                SKBZ/CMH RAWALAKOT PHARMACY
              </h2>
            </div>
          </div>
          <div style={{ width: 260, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: token.borderRadius
                }}
              >
                <UserOutlined style={{ color: token.colorTextSecondary, fontSize: 18 }} />
                <span style={{ color: token.colorText, fontWeight: 500 }}>
                  {currentUser?.full_name ?? 'User'}
                </span>
                {currentUser?.role ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: token.colorTextSecondary,
                      textTransform: 'capitalize'
                    }}
                  >
                    ({currentUser.role})
                  </span>
                ) : null}
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            margin: isPOS ? 12 : 24,
            padding: isPOS ? 12 : 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            minHeight: isPOS ? 0 : 360,
            height: isPOS ? 'calc(100vh - 64px - 24px)' : undefined,
            overflow: isPOS ? 'hidden' : undefined
          }}
        >
          <Suspense
            fallback={
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280 }}>
                <Spin size="large" tip="Loading..." />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </Content>

        {!isPOS && (
          <Footer style={{ textAlign: 'center', color: token.colorTextSecondary, fontSize: 13 }}>
            SKBZ/CMH RAWALAKOT PHARMACY v1.0
            <span style={{ marginLeft: 16, opacity: 0.9 }}>Press ? for shortcuts</span>
          </Footer>
        )}
      </Layout>
      <ShortcutsHelpModal />
    </Layout>
  )
}
