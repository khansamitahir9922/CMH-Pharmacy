import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, notification } from 'antd'
import { MedicineBoxOutlined, UserOutlined, LockOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const PASSWORD_MIN_LEN = 8
const LOGO_PATH = '/logo.png'

export function SetupWizard(): React.ReactElement {
  const [loading, setLoading] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const onFinish = async (values: {
    fullName: string
    username: string
    password: string
    confirmPassword: string
  }): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.api.invoke<{ success: boolean; error?: string }>(
        'auth:setup',
        {
          fullName: values.fullName,
          username: values.username,
          password: values.password
        }
      )
      if (result?.success) {
        notification.success({
          message: 'Administrator created',
          description: 'You can now sign in with your username and password.'
        })
        navigate('/login', { replace: true })
      } else {
        notification.error({
          message: 'Setup failed',
          description: result?.error ?? 'Could not create account.'
        })
      }
    } catch (err) {
      notification.error({
        message: 'Error',
        description: err instanceof Error ? err.message : 'Something went wrong.'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#F9FAFB'
      }}
    >
      {/* Left visual panel with hospital photo + gradient overlay and logo (same style as Login) */}
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
            First-time Administrator Setup
          </Title>
          <Text style={{ color: '#E5E7EB', fontSize: 13 }}>
            Create the first administrator account to securely manage medicines,
            inventory, billing and reporting.
          </Text>
        </div>
      </div>

      {/* Right setup form panel */}
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
            maxWidth: 440,
            width: '100%',
            boxShadow: '0 12px 40px rgba(15,23,42,0.08)',
            borderRadius: 16
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={3} style={{ marginBottom: 8, color: '#111827' }}>
              Welcome to SKBZ/CMH RAWALAKOT PHARMACY
            </Title>
            <Text
              type="secondary"
              style={{ display: 'block', marginBottom: 8, color: '#6B7280' }}
            >
              Create the first Administrator account
            </Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            requiredMark={true}
          >
            <Form.Item
              name="fullName"
              label="Full Name"
              rules={[
                { required: true, message: 'Please enter your full name.' },
                { min: 2, message: 'Full name must be at least 2 characters.' }
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="e.g. Dr. Ahmed Khan"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="username"
              label="Username"
              rules={[
                { required: true, message: 'Please choose a username.' },
                { min: 3, message: 'Username must be at least 3 characters.' },
                {
                  pattern: /^[a-zA-Z0-9_]+$/,
                  message: 'Username can only contain letters, numbers and underscore.'
                }
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="e.g. admin"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: 'Please enter a password.' },
                {
                  min: PASSWORD_MIN_LEN,
                  message: `Password must be at least ${PASSWORD_MIN_LEN} characters.`
                },
                {
                  pattern: /\d/,
                  message: 'Password must contain at least one number.'
                }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="Min 8 characters, one number"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Confirm Password"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your password.' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('Passwords do not match.'))
                  }
                })
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="Re-enter password"
                size="large"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                style={{ backgroundColor: '#1A56DB' }}
              >
                Create Administrator
              </Button>
            </Form.Item>
          </Form>

          <Button
            type="link"
            onClick={() => navigate('/login')}
            style={{ marginTop: 16, padding: 0 }}
          >
            Already have an account? Sign in
          </Button>
        </Card>
      </div>
    </div>
  )
}
