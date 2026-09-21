import { useState } from 'react'
import { CourseOutlineForm } from './CourseOutlineForm'
import { AnnouncementsPanel } from './AnnouncementsPanel'
import { GradebookPanel } from './GradebookPanel'
import { StudentGradeCard } from './StudentGradeCard'
import { ModulesPanel } from './ModulesPanel'
import { AssignmentsPanel } from './AssignmentsPanel'
import { AskTeacherPanel } from './AskTeacherPanel'
import { AISettingsPanel } from './AISettingsPanel'

interface AcademicLMSTabProps {
  groupId: string
  isAdmin: boolean
}

type LMSSubTab = 'outline' | 'announcements' | 'gradebook' | 'modules' | 'assignments' | 'ask-teacher' | 'ai-settings'

/** Design order. Course outline is for everyone (read-only for students); AI settings admin only. */
const SUB_TABS: { value: LMSSubTab; label: string; adminOnly?: boolean }[] = [
  { value: 'outline', label: 'Course outline' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'gradebook', label: 'Gradebook' },
  { value: 'modules', label: 'Modules' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'ask-teacher', label: 'Ask teacher' },
  { value: 'ai-settings', label: 'AI settings', adminOnly: true },
]

export function AcademicLMSTab({ groupId, isAdmin }: AcademicLMSTabProps) {
  const [subTab, setSubTab] = useState<LMSSubTab>('outline')
  const subTabs = SUB_TABS.filter((t) => !t.adminOnly || isAdmin)

  return (
    <div className="flex flex-col gap-4">
      <nav role="tablist" className="hide-bar" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
        {subTabs.map((tab) => {
          const active = subTab === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(tab.value)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      {subTab === 'outline' && <CourseOutlineForm groupId={groupId} readOnly={!isAdmin} />}
      {subTab === 'announcements' && <AnnouncementsPanel groupId={groupId} isAdmin={isAdmin} />}
      {subTab === 'gradebook' && (isAdmin ? <GradebookPanel groupId={groupId} /> : <StudentGradeCard groupId={groupId} />)}
      {subTab === 'modules' && <ModulesPanel groupId={groupId} isAdmin={isAdmin} />}
      {subTab === 'assignments' && <AssignmentsPanel groupId={groupId} isAdmin={isAdmin} />}
      {subTab === 'ask-teacher' && <AskTeacherPanel groupId={groupId} isAdmin={isAdmin} />}
      {subTab === 'ai-settings' && isAdmin && <AISettingsPanel groupId={groupId} />}
    </div>
  )
}
