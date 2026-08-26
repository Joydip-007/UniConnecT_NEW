import { Briefcase, BookOpen, FlaskConical, Monitor, Play, Rocket, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { GroupType } from './types'

/**
 * Each group type gets a glyph and a tone so a card is identifiable before its name is
 * read. The tone doubles as the type signal, which is why the type pill is dropped from
 * the card — the tinted tile already says "club" or "batch".
 */
export const TYPE_LOOK: Record<GroupType, { icon: LucideIcon; bg: string; fg: string; label: string }> = {
  department: { icon: Monitor, bg: 'var(--uc-indigo-bg)', fg: 'var(--uc-indigo-l)', label: 'Department' },
  club: { icon: Rocket, bg: 'var(--uc-orange-bg)', fg: 'var(--uc-orange-l)', label: 'Club' },
  batch: { icon: Users, bg: 'var(--uc-cyan-bg)', fg: 'var(--uc-cyan)', label: 'Batch' },
  research: { icon: FlaskConical, bg: 'var(--uc-mint-bg)', fg: 'var(--uc-mint)', label: 'Research' },
  interest: { icon: Play, bg: 'var(--uc-indigo-bg)', fg: 'var(--uc-indigo-l)', label: 'Interest' },
  academic: { icon: BookOpen, bg: 'var(--uc-mint-bg)', fg: 'var(--uc-mint)', label: 'Section' },
  other: { icon: Briefcase, bg: 'var(--surface-raised)', fg: 'var(--text-secondary)', label: 'Group' },
}
