import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoleBadge, ROLE_LABEL } from './RoleBadge'
import type { UserRole } from '@uniconnect/shared'

const ROLES: UserRole[] = ['student', 'alumni', 'faculty', 'admin', 'driver']

describe('RoleBadge', () => {
  it.each(ROLES)('renders an accessible %s badge with role class', (role) => {
    const { container } = render(<RoleBadge role={role} />)
    const badge = screen.getByRole('img', { name: ROLE_LABEL[role] })
    expect(badge).toBeInTheDocument()
    expect(container.querySelector(`.role-badge--${role}`)).toBe(badge)
  })

  it('renders the tooltip label by default, hidden from AT', () => {
    const { container } = render(<RoleBadge role="student" />)
    const tip = container.querySelector('.role-badge__tip')
    expect(tip).toHaveTextContent('Student')
    expect(tip).toHaveAttribute('aria-hidden', 'true')
  })

  it('omits the tooltip when showTooltip is false', () => {
    const { container } = render(<RoleBadge role="student" showTooltip={false} />)
    expect(container.querySelector('.role-badge__tip')).toBeNull()
  })

  it('sizes the glyph box from the size prop', () => {
    const { container } = render(<RoleBadge role="faculty" size={14} />)
    const badge = container.querySelector('.role-badge') as HTMLElement
    expect(badge.style.width).toBe('14px')
    expect(badge.style.height).toBe('14px')
  })
})
