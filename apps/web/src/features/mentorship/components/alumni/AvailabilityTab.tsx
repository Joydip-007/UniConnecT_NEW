import { useState } from 'react'
import { Check, Minus, Pencil, Plus, X } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useToastStore } from '@/stores/toastStore'
import { useUpdateMentorSettings } from '../../hooks/useMentorship'
import type { MentorSettings } from '../../types'
import { Btn, Eyebrow, Meter } from '../ui'
import { apiErrorMessage, cardStyle, fieldStyle, hairline } from '../styles'

const TOPIC_SUGGESTIONS = [
  'Backend',
  'Frontend',
  'Interviews',
  'Portfolio review',
  'Resume writing',
  'System design',
  'Data science',
  'Product management',
  'Higher studies',
]
const SLOT_SUGGESTIONS = ['Tue, 6:00 pm', 'Thu, 6:30 pm', 'Sat, 10:00 am', 'Sat, 11:00 am']
const MAX_CAPACITY = 20

type EditModal = null | 'topics' | 'availability'

export function AvailabilityTab({ settings, isLoading }: { settings: MentorSettings | undefined; isLoading: boolean }) {
  const show = useToastStore((s) => s.show)
  const update = useUpdateMentorSettings()
  const [modal, setModal] = useState<EditModal>(null)

  if (isLoading || !settings) {
    return <div style={{ ...cardStyle, padding: 24, fontSize: 13, color: 'var(--text-secondary)' }}>Loading your settings…</div>
  }

  function save(patch: Parameters<typeof update.mutate>[0]) {
    update.mutate(patch, {
      onError: (e) => show({ message: apiErrorMessage(e, 'Could not save'), type: 'error' }),
    })
  }

  const on = settings.isOpenToMentorship
  const dim = { opacity: on ? 1 : 0.5 }
  const minCapacity = Math.max(1, settings.currentMentees)
  const pct = settings.maxMentees > 0 ? (settings.currentMentees / settings.maxMentees) * 100 : 0

  return (
    <>
      <div style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Accepting new mentees</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {on ? 'Visible in the mentor directory while on' : 'Hidden from the mentor directory'}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Accepting new mentees"
          onClick={() => save({ isOpenToMentorship: !on })}
          style={{
            width: 40,
            height: 24,
            borderRadius: 'var(--r-pill)',
            background: on ? 'var(--uc-mint)' : 'var(--surface-raised)',
            position: 'relative',
            flexShrink: 0,
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            transition: 'background var(--dur-fast) var(--ease-out-strong)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: on ? 18 : 2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--on-accent)',
              transition: 'left var(--dur-fast) var(--ease-out-strong)',
            }}
          />
        </button>
      </div>

      <div style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, ...dim }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Mentee capacity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {settings.currentMentees} of {settings.maxMentees} places filled
            </span>
            <StepBtn
              label={`Decrease capacity (min ${minCapacity})`}
              disabled={settings.maxMentees <= minCapacity}
              onClick={() => save({ maxMentees: settings.maxMentees - 1 })}
            >
              <Minus size={13} />
            </StepBtn>
            <StepBtn
              label="Increase capacity"
              disabled={settings.maxMentees >= MAX_CAPACITY}
              onClick={() => save({ maxMentees: settings.maxMentees + 1 })}
            >
              <Plus size={13} />
            </StepBtn>
          </div>
        </div>
        <Meter pct={pct} color="var(--uc-mint)" height={4} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Raise your maximum to be shown to more students</span>
      </div>

      <div style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, ...dim }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Topics you mentor on</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {settings.topics.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '6px 12px',
                borderRadius: 'var(--r-pill)',
                background: 'var(--uc-indigo-bg)',
                color: 'var(--uc-indigo-xl)',
              }}
            >
              {t}
            </span>
          ))}
          {settings.topics.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
              No topics yet. Students filter mentors by topic.
            </span>
          )}
          <SmallGhost onClick={() => setModal('topics')}>Edit topics</SmallGhost>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, ...dim }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Weekly availability</span>
          <SmallGhost onClick={() => setModal('availability')} style={{ padding: '6px 10px' }}>
            Edit schedule
          </SmallGhost>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {settings.availability.map((slot) => (
            <span
              key={slot}
              style={{
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 'var(--r-pill)',
                background: 'var(--surface-raised)',
                border: hairline,
                color: 'var(--text-secondary)',
              }}
            >
              {slot}
            </span>
          ))}
          {settings.availability.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              No times yet. Students propose sessions from these slots.
            </span>
          )}
        </div>
      </div>

      {modal === 'topics' && (
        <TopicsModal topics={settings.topics} onSave={(topics) => save({ topics })} onClose={() => setModal(null)} />
      )}
      {modal === 'availability' && (
        <AvailabilityModal slots={settings.availability} onSave={(availability) => save({ availability })} onClose={() => setModal(null)} />
      )}
    </>
  )
}

function StepBtn({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="mentorship-row-btn"
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        border: '0.5px solid var(--border-hover)',
        background: 'transparent',
        color: 'var(--text-secondary)',
        fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        padding: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

function SmallGhost({ onClick, style, children }: { onClick: () => void; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12,
        padding: '6px 12px',
        borderRadius: 'var(--r-pill)',
        border: '0.5px solid var(--border-hover)',
        background: 'transparent',
        color: 'var(--text-secondary)',
        fontFamily: 'inherit',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

const addRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 40,
  padding: '8px 12px',
  borderRadius: 'var(--r-sm)',
  border: hairline,
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

const iconBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  lineHeight: 0,
  display: 'flex',
  padding: 2,
}

/** Free text plus a "+" — adds a value that is not in the suggestion list. */
function CustomAdd({ placeholder, maxLength, onAdd }: { placeholder: string; maxLength: number; onAdd: (value: string) => void }) {
  const [value, setValue] = useState('')
  const submit = () => {
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        style={{ ...fieldStyle, height: 40, padding: '0 12px', borderRadius: 'var(--r-sm)' }}
      />
      <Btn variant="primary" height={40} disabled={!value.trim()} onClick={submit} aria-label="Add">
        <Plus size={14} />
      </Btn>
    </div>
  )
}

function TopicsModal({ topics, onSave, onClose }: { topics: string[]; onSave: (topics: string[]) => void; onClose: () => void }) {
  const options = TOPIC_SUGGESTIONS.filter((t) => !topics.includes(t))
  return (
    <Modal isOpen onClose={onClose} title="Edit topics" maxWidth={420} sheet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Eyebrow style={{ fontSize: 12 }}>Currently mentoring on</Eyebrow>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {topics.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>None yet.</span>}
          {topics.map((t) => (
            <span
              key={t}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                padding: '6px 8px 6px 12px',
                borderRadius: 'var(--r-pill)',
                background: 'var(--uc-indigo-bg)',
                color: 'var(--uc-indigo-xl)',
              }}
            >
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => onSave(topics.filter((x) => x !== t))} style={{ ...iconBtn, color: 'inherit', padding: 0 }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <Eyebrow style={{ fontSize: 12 }}>Add a topic</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {options.map((t) => (
            <button key={t} type="button" className="mentorship-menu-item" style={addRow} onClick={() => onSave([...topics, t])}>
              {t}
              <Plus size={14} />
            </button>
          ))}
          <CustomAdd placeholder="Another topic" maxLength={40} onAdd={(t) => !topics.includes(t) && onSave([...topics, t])} />
        </div>
      </div>
    </Modal>
  )
}

function AvailabilityModal({ slots, onSave, onClose }: { slots: string[]; onSave: (slots: string[]) => void; onClose: () => void }) {
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const addable = SLOT_SUGGESTIONS.filter((s) => !slots.includes(s))

  function saveEdit() {
    if (editing === null) return
    const next = [...slots]
    next[editing] = draft.trim() || next[editing]
    onSave(next)
    setEditing(null)
  }

  return (
    <Modal isOpen onClose={onClose} title="Weekly availability" maxWidth={420} sheet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {slots.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No time slots yet.</span>}
          {slots.map((slot, i) =>
            editing === i ? (
              <div
                key={slot}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 12px', borderRadius: 'var(--r-sm)', background: 'var(--surface-raised)' }}
              >
                <input
                  type="text"
                  autoFocus
                  value={draft}
                  maxLength={100}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  aria-label="Time slot"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: 'transparent',
                    border: '0.5px solid var(--border-hover)',
                    borderRadius: 'var(--r-sm)',
                    padding: '6px 8px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
                <button type="button" aria-label="Save time slot" onClick={saveEdit} style={{ ...iconBtn, color: 'var(--uc-mint)' }}>
                  <Check size={15} />
                </button>
                <button type="button" aria-label="Cancel editing" onClick={() => setEditing(null)} style={iconBtn}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                key={slot}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--surface-raised)',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                }}
              >
                <span>{slot}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    title="Edit time slot"
                    aria-label={`Edit ${slot}`}
                    onClick={() => {
                      setEditing(i)
                      setDraft(slot)
                    }}
                    style={iconBtn}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    title="Remove time slot"
                    aria-label={`Remove ${slot}`}
                    onClick={() => onSave(slots.filter((_, idx) => idx !== i))}
                    style={iconBtn}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
        <Eyebrow style={{ fontSize: 12 }}>Add a time slot</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {addable.map((s) => (
            <button key={s} type="button" className="mentorship-menu-item" style={addRow} onClick={() => onSave([...slots, s])}>
              {s}
              <Plus size={14} />
            </button>
          ))}
          <CustomAdd placeholder="e.g. Wed, 7:00 to 8:00 pm" maxLength={100} onAdd={(s) => !slots.includes(s) && onSave([...slots, s])} />
        </div>
      </div>
    </Modal>
  )
}
