import { useState } from 'react'
import { CourseOutlineForm } from './CourseOutlineForm'
import { GradebookPanel } from './GradebookPanel'
import { StudentGradeCard } from './StudentGradeCard'
import { ModulesPanel } from './ModulesPanel'
import { AssignmentsPanel } from './AssignmentsPanel'
import { AISettingsPanel } from './AISettingsPanel'

interface AcademicLMSTabProps {
  groupId: string
  isAdmin: boolean
}

type LMSSubTab = 'outline' | 'gradebook' | 'modules' | 'assignments' | 'ai-settings'

const subTabButtonStyle = {
  borderColor: 'var(--border-default)',
  background: 'var(--surface-card)',
} as const

export function AcademicLMSTab({ groupId, isAdmin }: AcademicLMSTabProps) {
  const [subTab, setSubTab] = useState<LMSSubTab>('modules')

  const subTabs: { value: LMSSubTab; label: string }[] = [
    ...(isAdmin ? ([{ value: 'outline', label: 'Course outline' }] as const) : []),
    { value: 'gradebook', label: 'Gradebook' },
    { value: 'modules', label: 'Modules' },
    { value: 'assignments', label: 'Assignments' },
    ...(isAdmin ? ([{ value: 'ai-settings', label: 'AI settings' }] as const) : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <nav role="tablist" className="flex gap-2">
        {subTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={subTab === tab.value}
            onClick={() => setSubTab(tab.value)}
            className="rounded-[var(--r-pill)] border-[0.5px] px-4 py-2"
            style={{
              ...subTabButtonStyle,
              color: subTab === tab.value ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: subTab === tab.value ? 'var(--surface-raised)' : 'var(--surface-card)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {subTab === 'outline' && isAdmin && <CourseOutlineForm groupId={groupId} />}
      {subTab === 'gradebook' && (isAdmin ? <GradebookPanel groupId={groupId} /> : <StudentGradeCard groupId={groupId} />)}
      {subTab === 'modules' && <ModulesPanel groupId={groupId} isAdmin={isAdmin} />}
      {subTab === 'assignments' && <AssignmentsPanel groupId={groupId} isAdmin={isAdmin} />}
      {subTab === 'ai-settings' && isAdmin && <AISettingsPanel groupId={groupId} />}
    </div>
  )
}
