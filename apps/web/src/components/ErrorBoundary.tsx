import React, { useState } from 'react'
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Copy, RotateCcw, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { ErrorScreenHeader } from '@/components/ErrorScreenHeader'
import { compactBtnClass, errorActionsStyle } from '@/components/errorScreenStyles'
import { roleHome } from '@/config/roleHome'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { copyErrorReport, formatErrorTime, makeErrorId, type ErrorReport } from '@/lib/errorReport'
import { useAuthStore } from '@/stores/authStore'
import { useBareShell } from '@/stores/shellStore'
import { ReportProblemModal } from '@/features/problem-reports'

const monoFont = "ui-monospace, 'SF Mono', Menlo, monospace"

function toReport(error: Error): ErrorReport {
  return { id: makeErrorId(), at: new Date(), message: `${error.name}: ${error.message}` }
}

// ── Root boundary: the whole app crashed ───────────────────────────────────────

interface RootState { report: ErrorReport | null }

class RootErrorBoundary extends React.Component<React.PropsWithChildren, RootState> {
  state: RootState = { report: null }

  static getDerivedStateFromError(error: Error): RootState {
    return { report: toReport(error) }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.state.report?.id ?? ''}`, error, info)
  }

  render() {
    if (this.state.report) return <CrashScreen report={this.state.report} />
    return this.props.children
  }
}

export default RootErrorBoundary

function CrashScreen({ report }: { report: ErrorReport }) {
  const compact = useMediaQuery('(max-width: 767px)')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  // Rendered above the router and the query client, so the role is read straight off
  // the store and navigation is a full page load rather than a router push.
  const role = useAuthStore((s) => (s.accessToken ? s.user?.role : null))
  const home = roleHome(role)
  const iconSize = compact ? 16 : 15
  const btnClass = compact ? compactBtnClass : ''
  const Chevron = detailsOpen ? ChevronUp : ChevronDown

  // No toast here: the Toaster lives inside App, which is what just crashed.
  async function copyDetails() {
    setCopyState((await copyErrorReport(report)) ? 'copied' : 'failed')
    setTimeout(() => setCopyState('idle'), 2000)
  }

  const errorCode = (
    <code style={{ fontFamily: monoFont, fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
      {report.message}
    </code>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <ErrorScreenHeader compact={compact} />
      <main
        role="alert"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: compact ? '24px 20px' : 24,
        }}
      >
        <div
          style={{
            width: compact ? '100%' : 460,
            maxWidth: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            textAlign: 'center',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: compact ? 48 : 52,
              height: compact ? 48 : 52,
              borderRadius: 'var(--r-md)',
              background: 'var(--uc-red-bg)',
              border: '0.5px solid var(--uc-red-bdr)',
              color: 'var(--uc-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TriangleAlert size={compact ? 22 : 24} strokeWidth={1.5} />
          </div>
          <h1 style={{ margin: 0, fontSize: compact ? 20 : 22, fontWeight: 500, color: 'var(--text-primary)' }}>
            Something went wrong
          </h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
            UniConnecT hit an unexpected error and had to stop. Reloading usually fixes it. Nothing you've already
            posted or sent is lost.
          </p>
          <div style={{ ...errorActionsStyle(compact), marginTop: 6 }}>
            <PrimaryBtn onClick={() => window.location.reload()} className={btnClass}>
              <RotateCcw size={iconSize} strokeWidth={1.5} />
              Reload page
            </PrimaryBtn>
            <GhostBtn onClick={() => window.location.assign(home.path)} className={btnClass}>
              <home.icon size={iconSize} strokeWidth={1.5} />
              Go to {home.name}
            </GhostBtn>
          </div>

          {compact ? (
            <>
              <button
                type="button"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((o) => !o)}
                style={{
                  minHeight: 44,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: 'none',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                Technical details
                <Chevron size={14} strokeWidth={1.5} />
              </button>
              {detailsOpen && (
                <div
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    textAlign: 'left',
                    background: 'var(--surface-card)',
                    border: '0.5px solid var(--border-default)',
                    borderRadius: 'var(--r-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {errorCode}
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Error ID {report.id}</span>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                width: '100%',
                marginTop: 10,
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-md)',
                textAlign: 'left',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((o) => !o)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'none',
                  border: 'none',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <span>Technical details</span>
                <Chevron size={15} strokeWidth={1.5} />
              </button>
              {detailsOpen && (
                <div
                  style={{
                    borderTop: '0.5px solid var(--border-default)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {errorCode}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      Error ID {report.id} · {formatErrorTime(report.at)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyDetails()}
                      style={{
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        border: '0.5px solid var(--border-default)',
                        borderRadius: 'var(--r-pill)',
                        background: 'var(--surface-raised)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <Copy size={13} strokeWidth={1.5} />
                      {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Could not copy' : 'Copy details'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Page boundary: one lazy page failed inside the shell ───────────────────────

interface Props {
  children: React.ReactNode
  /** Clears a caught error when it changes, so navigating to another page recovers. */
  resetKey?: string
}

interface State {
  report: ErrorReport | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { report: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { report: toReport(error) }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.state.report?.id ?? ''}`, error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.report && prev.resetKey !== this.props.resetKey) this.setState({ report: null })
  }

  private retry = () => this.setState({ report: null })

  render() {
    if (this.state.report) return <SectionError report={this.state.report} onRetry={this.retry} />
    return this.props.children
  }
}

// List pages a detail route's back link returns to, by first path segment.
const SECTION_LABEL: Record<string, string> = {
  feed: 'Feed',
  jobs: 'Jobs',
  events: 'Events',
  groups: 'Groups',
  news: 'News',
  settings: 'Settings',
  explore: 'Explore',
  admin: 'Admin',
  messages: 'Messages',
}

function SectionBackLink() {
  const location = useLocation()
  const navigate = useNavigate()
  const [section, ...rest] = location.pathname.split('/').filter(Boolean)
  const label = rest.length > 0 && section ? SECTION_LABEL[section] : undefined

  function goBack() {
    if (label) navigate(`/${section}`)
    else if (location.key !== 'default') navigate(-1)
    else navigate('/')
  }

  return (
    <button
      type="button"
      onClick={goBack}
      style={{
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: 0,
        background: 'none',
        border: 'none',
        fontFamily: 'inherit',
        fontSize: 13,
        color: 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      <ArrowLeft size={14} strokeWidth={1.5} />
      {label ?? 'Back'}
    </button>
  )
}

function SectionError({ report, onRetry }: { report: ErrorReport; onRetry: () => void }) {
  useBareShell()
  const inRouter = useInRouterContext()
  const signedIn = useAuthStore((s) => Boolean(s.accessToken && s.user))
  const [reportOpen, setReportOpen] = useState(false)

  // Signed-out pages (landing, login) have no account to file under, so the report
  // falls back to the clipboard for the visitor to pass on themselves.
  async function reportProblem() {
    if (signedIn) {
      setReportOpen(true)
      return
    }
    const ok = await copyErrorReport(report)
    if (ok) toast.success(`Problem details copied. Send them to your university admin with error ID ${report.id}.`)
    else toast.error(`Could not copy the details. Quote error ID ${report.id} when you report it.`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {inRouter && <SectionBackLink />}
      <div
        role="alert"
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
        <RotateCcw size={32} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          This page didn't load
        </p>
        <p
          style={{
            margin: 0,
            maxWidth: 340,
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            textWrap: 'pretty',
          }}
        >
          Something went wrong while showing it. The rest of UniConnecT still works, and your data is safe.
        </p>
        <div style={{ marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <PrimaryBtn onClick={onRetry}>Try again</PrimaryBtn>
          <GhostBtn onClick={() => void reportProblem()}>Report a problem</GhostBtn>
        </div>
      </div>
      {/* Mounted only while open: the mutation inside needs the query client, and a
          boundary can render in places (tests, a failed provider) that have none. */}
      {reportOpen && <ReportProblemModal report={report} isOpen onClose={() => setReportOpen(false)} />}
    </div>
  )
}
