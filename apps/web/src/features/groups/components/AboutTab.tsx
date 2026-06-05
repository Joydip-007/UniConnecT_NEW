import { useState } from 'react'
import { useSetRules } from '@/features/groups'

interface Props {
  groupId: string
  rulesMd?: string | null
  canEdit?: boolean
}

export function AboutTab({ groupId, rulesMd, canEdit }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rulesMd ?? '')
  const setRulesMutation = useSetRules(groupId)

  if (!rulesMd && !canEdit) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No rules or about info set yet.</p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 16 }}>
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={5000}
            rows={12}
            style={{ width: '100%', padding: '10px', fontSize: 13, fontWeight: 400, background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-sm)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{draft.length} / 5 000</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setEditing(false); setDraft(rulesMd ?? '') }}
                style={{ padding: '5px 12px', fontSize: 12, fontWeight: 400, borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button"
                disabled={setRulesMutation.isPending}
                onClick={() => setRulesMutation.mutate(draft, { onSuccess: () => setEditing(false) })}
                style={{ padding: '5px 12px', fontSize: 12, fontWeight: 400, borderRadius: 'var(--r-pill)', border: 'none', background: 'var(--uc-indigo)', color: 'var(--on-accent)', cursor: setRulesMutation.isPending ? 'not-allowed' : 'pointer', opacity: setRulesMutation.isPending ? 0.7 : 1 }}>
                {setRulesMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button type="button" onClick={() => { setDraft(rulesMd ?? ''); setEditing(true) }}
                style={{ padding: '4px 12px', fontSize: 12, fontWeight: 400, borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Edit
              </button>
            </div>
          )}
          {rulesMd ? (
            <pre style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, fontFamily: 'inherit' }}>
              {rulesMd}
            </pre>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No rules set yet. Click edit to add them.</p>
          )}
        </>
      )}
    </div>
  )
}
