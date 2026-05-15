import React from 'react'
import { RotateCcw } from 'lucide-react'
import { PrimaryBtn } from '@/components/Button'

interface RootState { hasError: boolean; error: Error | null }

class RootErrorBoundary extends React.Component<React.PropsWithChildren, RootState> {
  state: RootState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): RootState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '16px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
            Something went wrong
          </p>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default RootErrorBoundary

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private retry = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            textAlign: 'center',
          }}
        >
          <RotateCcw
            size={32}
            strokeWidth={1.5}
            style={{ color: 'var(--text-tertiary)' }}
          />
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            Something went wrong
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              maxWidth: 340,
            }}
          >
            An unexpected error occurred. Your data is safe — try refreshing this
            section.
          </p>
          <div style={{ marginTop: 4 }}>
            <PrimaryBtn onClick={this.retry}>Try again</PrimaryBtn>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
