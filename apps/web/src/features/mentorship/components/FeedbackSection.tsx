import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { useRequestFeedback } from '../hooks/useRequestFeedback'
import { useSubmitFeedback } from '../hooks/useSubmitFeedback'

interface FeedbackSectionProps {
  requestId: string
  authorRole: 'student' | 'alumni'
}

export function FeedbackSection({ requestId, authorRole }: FeedbackSectionProps) {
  const { data, isLoading } = useRequestFeedback(requestId)
  const submitMutation = useSubmitFeedback()
  const [expanded, setExpanded] = useState(false)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')

  if (isLoading) return null

  const mySlot = authorRole === 'student' ? data?.student : data?.alumni
  const alreadySubmitted = mySlot !== null && mySlot !== undefined

  if (alreadySubmitted) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 4,
          fontSize: 12,
          color: 'var(--text-tertiary)',
        }}
      >
        <CheckCircle size={13} />
        Feedback submitted · {mySlot.rating}/5
        {mySlot.comment && (
          <span style={{ fontStyle: 'italic' }}>— "{mySlot.comment}"</span>
        )}
      </div>
    )
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={{
          marginTop: 4,
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--uc-indigo-xl)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          borderRadius: 'var(--r-pill)',
        }}
      >
        Leave feedback
      </button>
    )
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: '12px 14px',
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
        Rate this mentorship
      </p>

      {/* Star rating */}
      <div style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 2px',
              fontSize: 22,
              lineHeight: 1,
              color:
                star <= (hovered || rating)
                  ? 'var(--uc-orange)'
                  : 'var(--border-default)',
              transition: 'color 80ms',
            }}
            aria-label={`Rate ${star} out of 5`}
          >
            ★
          </button>
        ))}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional — what went well or could improve?"
        rows={2}
        maxLength={1000}
        style={{
          width: '100%',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-sm)',
          color: 'var(--text-primary)',
          fontSize: 12,
          fontWeight: 400,
          padding: '8px 10px',
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          disabled={rating === 0 || submitMutation.isPending}
          onClick={() => {
            submitMutation.mutate(
              { requestId, rating, comment: comment.trim() || undefined },
              { onSuccess: () => setExpanded(false) },
            )
          }}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: '6px 16px',
            borderRadius: 'var(--r-pill)',
            border: 'none',
            background: rating > 0 ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
            color: rating > 0 ? 'var(--uc-indigo-xl)' : 'var(--text-tertiary)',
            cursor: rating === 0 || submitMutation.isPending ? 'not-allowed' : 'pointer',
            opacity: submitMutation.isPending ? 0.6 : 1,
            transition: 'background 150ms, color 150ms',
          }}
        >
          {submitMutation.isPending ? 'Submitting…' : 'Submit'}
        </button>
        <button
          type="button"
          onClick={() => { setExpanded(false); setRating(0); setComment('') }}
          style={{
            fontSize: 12,
            fontWeight: 400,
            padding: '6px 12px',
            borderRadius: 'var(--r-pill)',
            border: '0.5px solid var(--border-default)',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        {submitMutation.isError && (
          <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>Failed. Please try again.</span>
        )}
      </div>
    </div>
  )
}
