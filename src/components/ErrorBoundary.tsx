import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Result } from 'antd'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Catches JavaScript errors in the child tree and shows a fallback UI
 * instead of a white screen. User can reload to recover.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F9FAFB',
            padding: 24
          }}
        >
          <Result
            status="error"
            title="Something went wrong"
            subTitle="The app ran into an error. You can try reloading the page to continue."
            extra={
              <Button type="primary" onClick={this.handleReload}>
                Reload app
              </Button>
            }
          />
        </div>
      )
    }
    return this.props.children
  }
}
