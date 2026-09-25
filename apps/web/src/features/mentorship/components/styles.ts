import type { CSSProperties } from 'react'
import { isAxiosError } from 'axios'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/** Style tokens and helpers shared by the mentorship components (kept apart from them for fast refresh). */

export type BtnVariant = 'ghost' | 'primary' | 'danger' | 'mint' | 'quiet'

const VARIANT: Record<BtnVariant, CSSProperties> = {
  ghost: { border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)' },
  primary: { border: 'none', background: 'var(--uc-indigo)', color: 'var(--on-indigo)', fontWeight: 500 },
  danger: { border: 'none', background: 'var(--uc-red)', color: 'var(--on-red)', fontWeight: 500 },
  mint: { border: 'none', background: 'var(--uc-mint)', color: 'var(--on-accent)', fontWeight: 500 },
  quiet: { border: 'none', background: 'transparent', color: 'var(--text-tertiary)' },
}

export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)')
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) return err.response.data.error
  return fallback
}

export const cardStyle: CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
}

export const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.04em',
  color: 'var(--text-label)',
}

export const hairline = '0.5px solid var(--border-default)'

export function btnStyle(variant: BtnVariant, height = 32): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: height,
    padding: '0 12px',
    boxSizing: 'border-box',
    fontSize: 12,
    fontWeight: 400,
    borderRadius: 'var(--r-pill)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    ...VARIANT[variant],
  }
}

export function choiceStyle(on: boolean, height = 32): CSSProperties {
  return {
    minHeight: height,
    padding: '0 12px',
    fontSize: 12,
    borderRadius: 'var(--r-pill)',
    border: on ? '0.5px solid var(--uc-indigo-bdr)' : '0.5px solid var(--border-hover)',
    background: on ? 'var(--uc-indigo-bg)' : 'transparent',
    color: on ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
    fontWeight: on ? 500 : 400,
    fontFamily: 'inherit',
    cursor: 'pointer',
  }
}

export const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 13,
  fontFamily: 'inherit',
  color: 'var(--text-primary)',
  background: 'var(--surface-card)',
  border: hairline,
  borderRadius: 'var(--r-md)',
  outline: 'none',
}

export const textareaStyle: CSSProperties = {
  ...fieldStyle,
  resize: 'vertical',
  minHeight: 60,
  padding: '8px 12px',
  lineHeight: 1.5,
}

