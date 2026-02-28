import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, Alert, notification, Spin } from 'antd'
import { MedicineBoxOutlined, UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'

const { Title, Text } = Typography

const LOGO_PATH = '/logo.png'

export function LoginPage(): React.ReactElement {
  const [loading, setLoading] = useState(false)
  const [checkingFirstRun, setCheckingFirstRun] = useState(true)
  const [logoError, setLogoError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [form] = Form.useForm()

  useEffect(() => {
    let cancelled = false
    window.api
      .invoke<boolean>('auth:checkFirstRun')
      .then((isFirstRun) => {
        if (!cancelled && isFirstRun) {
          navigate('/setup', { replace: true })
          return
        }
        if (!cancelled) setCheckingFirstRun(false)
      })
      .catch(() => {
        if (!cancelled) setCheckingFirstRun(false)
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  const onFinish = async (values: { username: string; password: string }): Promise<void> => {
    setError(null)
    setLoading(true)
    try {
      const user = await window.api.invoke<{
        id: number
        username: string
        full_name: string
        role: string
      } | null>('auth:login', {
        username: values.username,
        password: values.password
      })
      if (user) {
        login({
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role as 'admin' | 'manager' | 'pharmacist' | 'dataentry'
        })
        notification.success({ message: 'Signed in successfully' })
        navigate('/app-loading', { replace: true })
      } else {
        setError('Invalid username or password. Please try again.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingFirstRun) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F3F4F6'
        }}
      >
        <Spin size="large" tip="Loading..." />
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#F3F4F6'
      }}
    >
      {/* Left visual panel with hospital photo + gradient overlay and logo */}
      <div
        style={{
          flex: '0 0 58%',
          minWidth: 420,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          backgroundImage:
            'linear-gradient(135deg, rgba(26,86,219,0.88) 0%, rgba(15,59,149,0.9) 35%, rgba(236,72,153,0.85) 70%, rgba(249,115,22,0.9) 100%), url(/hospital.jpg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundColor: 'rgba(15,59,149,0.95)',
          color: '#F9FAFB'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.25)',
            padding: 24,
            background: 'rgba(15,23,42,0.35)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            {!logoError ? (
              <img
                src={LOGO_PATH}
                alt="SKBZ/CMH RAWALAKOT PHARMACY"
                style={{ height: 80, width: 'auto', objectFit: 'contain' }}
                onError={() => setLogoError(true)}
              />
            ) : (
              <MedicineBoxOutlined style={{ fontSize: 56, color: '#E5E7EB' }} />
            )}
          </div>
          <Text style={{ color: '#D1D5DB', letterSpacing: 2, fontSize: 12 }}>
            SKBZ/CMH RAWALAKOT PHARMACY
          </Text>
          <Title
            level={3}
            style={{
              marginTop: 8,
              marginBottom: 8,
              color: '#F9FAFB',
              fontWeight: 700
            }}
          >
            Safe, Reliable Pharmacy Care
          </Title>
          <Text style={{ color: '#E5E7EB', fontSize: 13 }}>
            Manage medicines, inventory and billing with hospital-grade controls and
            complete traceability.
          </Text>
        </div>
      </div>

      {/* Right form panel */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32
        }}
      >
        <Card
          style={{
            maxWidth: 420,
            width: '100%',
            boxShadow: '0 12px 40px rgba(15,23,42,0.08)',
            borderRadius: 16
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={3} style={{ marginBottom: 8, color: '#111827' }}>
              SKBZ/CMH RAWALAKOT PHARMACY
            </Title>
            <Text
              type="secondary"
              style={{ display: 'block', marginBottom: 8, color: '#6B7280' }}
            >
              Sign in to your account
            </Text>
          </div>

          {error ? (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 16, textAlign: 'left' }}
            />
          ) : null}

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            requiredMark={true}
          >
            <Form.Item
              name="username"
              label="Username"
              rules={[
                { required: true, message: 'Please enter your username.' },
                { min: 2, message: 'Username must be at least 2 characters.' }
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="Enter your username"
                size="large"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please enter your password.' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="Enter your password"
                size="large"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                style={{ backgroundColor: '#1A56DB' }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>

          <Button
            type="link"
            onClick={() => navigate('/setup')}
            style={{ marginTop: 16, padding: 0 }}
          >
            First time? Create administrator account
          </Button>

          <Text type="secondary" style={{ display: 'block', marginTop: 24, fontSize: 12 }}>
            SKBZ/CMH RAWALAKOT PHARMACY v1.0
          </Text>
        </Card>
      </div>
    </div>
  )
}
