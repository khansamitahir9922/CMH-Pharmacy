import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography } from 'antd'
import { MedicineBoxOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'

const { Title, Text } = Typography
const LOGO_PATH = '/logo.png'
const PHARMACY_NAME = 'SKBZ/CMH RAWALAKOT PHARMACY'
const LOAD_DURATION_MS = 2200

export function AppLoadingScreen(): React.ReactElement {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [progress, setProgress] = useState(0)
  const [logoError, setLogoError] = useState(false)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }
    const animate = (timestamp: number): void => {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const p = Math.min(100, (elapsed / LOAD_DURATION_MS) * 100)
      setProgress(p)
      if (p < 100) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        navigate('/dashboard', { replace: true })
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isAuthenticated, navigate])

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
        padding: 48
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          maxWidth: 520
        }}
      >
        {!logoError ? (
          <img
            src={LOGO_PATH}
            alt={PHARMACY_NAME}
            style={{
              height: 240,
              width: 'auto',
              maxWidth: 'min(420px, 85vw)',
              objectFit: 'contain',
              marginBottom: 32
            }}
            onError={() => setLogoError(true)}
          />
        ) : (
          <div style={{ marginBottom: 32 }}>
            <MedicineBoxOutlined
              style={{ fontSize: 180, color: '#1A56DB' }}
            />
          </div>
        )}
        <Title
          level={2}
          style={{
            margin: 0,
            textAlign: 'center',
            color: '#111827',
            fontWeight: 700,
            letterSpacing: 0.5
          }}
        >
          {PHARMACY_NAME}
        </Title>
        <Text
          type="secondary"
          style={{
            display: 'block',
            marginTop: 8,
            fontSize: 14,
            color: '#6B7280'
          }}
        >
          Loading your workspace...
        </Text>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: '#E5E7EB'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #1A56DB 0%, #3B82F6 100%)',
            transition: 'width 0.15s ease-out'
          }}
        />
      </div>
    </div>
  )
}
