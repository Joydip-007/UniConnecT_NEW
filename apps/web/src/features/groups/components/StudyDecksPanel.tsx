import { useMemo, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { BookOpen, Layers, Pencil, RotateCcw, Save, Trash2, X } from 'lucide-react'
import {
  useCreateFlashcard,
  useCreateFlashcardDeck,
  useDeleteFlashcard,
  useFlashcardDecks,
  useFlashcards,
  useReviewFlashcard,
  useReviewQueue,
  useUpdateFlashcard,
} from '../hooks/useGroupExtended'
import type { Flashcard, FlashcardDeck, FlashcardReviewResult, MemberRole, ReviewRating } from '../types'
import {
  AcademicOnlyNotice,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PanelHeader,
} from './StudyToolsPrimitives'
import {
  controlButton,
  fieldStyle,
  iconButton,
  listSurface,
} from './StudyToolsStyles'

const EMPTY_DECKS: FlashcardDeck[] = []

export function StudyDecksPanel({ groupId, currentUserId, userRole }: {
  groupId: string
  currentUserId?: string
  userRole: MemberRole | null
}) {
  const decksQuery = useFlashcardDecks(groupId)
  const decks = decksQuery.data ?? EMPTY_DECKS
  const createDeck = useCreateFlashcardDeck(groupId)
  // The API decides who gets flashcard decks (academic groups created by faculty) —
  // a 403 from the decks query is the locked state, never a groupType guess on the client.
  const isLocked = decksQuery.isError && isAxiosError(decksQuery.error) && decksQuery.error.response?.status === 403
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [showNewDeck, setShowNewDeck] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const activeDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId) ?? decks[0] ?? null,
    [decks, selectedDeckId],
  )
  const totalCards = decks.reduce((sum, deck) => sum + deck.cardCount, 0)
  const totalDue = decks.reduce((sum, deck) => sum + deck.dueCount, 0)

  function submitDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createDeck.mutate({ title, description: description || null }, {
      onSuccess: () => {
        setTitle('')
        setDescription('')
        setShowNewDeck(false)
      },
    })
  }

  if (isLocked) {
    return (
      <section style={listSurface}>
        <AcademicOnlyNotice
          message="Flashcard decks are available in academic groups created by faculty."
          subtitle="Sessions still work here."
          icon="🎓"
        />
      </section>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12, alignItems: 'start' }}>
      <section style={listSurface}>
        <PanelHeader title="Decks" icon={<Layers size={16} strokeWidth={1.7} />} actionLabel="New deck" onAction={() => setShowNewDeck(true)} />
        {showNewDeck && (
          <form onSubmit={submitDeck} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderTop: '0.5px solid var(--border-default)' }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deck title" required style={fieldStyle} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setShowNewDeck(false)} style={controlButton}><X size={14} />Cancel</button>
              <button type="submit" disabled={createDeck.isPending} style={{ ...controlButton, background: 'var(--uc-indigo)', color: 'var(--on-accent)', border: 'none' }}><Save size={14} />Create</button>
            </div>
          </form>
        )}
        {decksQuery.isLoading ? (
          <ListSkeleton rows={3} />
        ) : decksQuery.isError ? (
          <ErrorState message="Could not load decks." onRetry={() => { void decksQuery.refetch() }} />
        ) : (
          <>
            <DeckSummary totalDecks={decks.length} dueCards={totalDue} totalCards={totalCards} />
            {decks.length === 0 ? (
              <EmptyState title="No decks yet" actionLabel="New deck" onAction={() => setShowNewDeck(true)} />
            ) : decks.map((deck) => (
              <DeckRow key={deck.id} deck={deck} selected={activeDeck?.id === deck.id} onSelect={() => setSelectedDeckId(deck.id)} />
            ))}
          </>
        )}
      </section>
      {activeDeck ? (
        <DeckDetailPanel groupId={groupId} deck={activeDeck} currentUserId={currentUserId} userRole={userRole} />
      ) : (
        <DeckPlaceholder />
      )}
    </div>
  )
}

function DeckSummary({ totalDecks, dueCards, totalCards }: { totalDecks: number; dueCards: number; totalCards: number }) {
  return (
    <div style={{ minHeight: 52, padding: '10px 14px', borderTop: '0.5px solid var(--border-default)', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
      {[
        ['Decks', totalDecks],
        ['Due', dueCards],
        ['Cards', totalCards],
      ].map(([label, value]) => (
        <div key={label} style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        </div>
      ))}
    </div>
  )
}

function DeckRow({ deck, selected, onSelect }: { deck: FlashcardDeck; selected: boolean; onSelect: () => void }) {
  const masteredPct = deck.cardCount ? Math.round((deck.masteredCount / deck.cardCount) * 100) : 0

  return (
    <article
      style={{
        minHeight: 92,
        padding: '12px 14px',
        borderTop: '0.5px solid var(--border-default)',
        background: selected ? 'var(--uc-indigo-bg)' : 'transparent',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <button type="button" onClick={onSelect} style={{ margin: 0, padding: 0, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', textWrap: 'balance' }}>
          {deck.title}
        </button>
        {deck.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{deck.description}</p>}
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
          {deck.cardCount} cards · {deck.dueCount} due today
        </p>
        <div style={{ margin: '8px 0 4px', height: 4, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${masteredPct}%`, borderRadius: 'var(--r-pill)', background: 'var(--uc-indigo)' }} />
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{masteredPct}% mastered</p>
      </div>
      <button
        type="button"
        onClick={onSelect}
        style={{ padding: '6px 16px', fontSize: 13, fontWeight: 400, borderRadius: 'var(--r-pill)', border: 'none', background: 'var(--uc-indigo)', color: 'var(--on-accent)', cursor: 'pointer' }}
      >
        Study
      </button>
    </article>
  )
}

function DeckDetailPanel({ groupId, deck, currentUserId, userRole }: {
  groupId: string
  deck: FlashcardDeck
  currentUserId?: string
  userRole: MemberRole | null
}) {
  const { data: cards = [], isLoading } = useFlashcards(groupId, deck.id)
  const createCard = useCreateFlashcard(groupId, deck.id)
  const updateCard = useUpdateFlashcard(groupId, deck.id)
  const deleteCard = useDeleteFlashcard(groupId, deck.id)
  const [showNewCard, setShowNewCard] = useState(false)
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null)
  const canManageAll = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator'

  function canManageCard(card: Flashcard) {
    return canManageAll || (!!currentUserId && (card.createdBy === currentUserId || deck.createdBy === currentUserId))
  }

  return (
    <section style={{ ...listSurface, minHeight: 280 }}>
      <PanelHeader
        title={deck.title}
        icon={<BookOpen size={16} strokeWidth={1.7} />}
        actionLabel="New card"
        onAction={() => { setEditingCard(null); setShowNewCard(true) }}
        meta={<p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{deck.dueCount} due · {deck.cardCount} cards</p>}
      />
      <ReviewPanel groupId={groupId} deckId={deck.id} />
      {(showNewCard || editingCard) && (
        <CardForm
          initial={editingCard}
          isPending={createCard.isPending || updateCard.isPending}
          onCancel={() => { setShowNewCard(false); setEditingCard(null) }}
          onSubmit={(input) => {
            if (editingCard) {
              updateCard.mutate({ cardId: editingCard.id, input }, { onSuccess: () => setEditingCard(null) })
            } else {
              createCard.mutate(input, { onSuccess: () => setShowNewCard(false) })
            }
          }}
        />
      )}
      {isLoading ? <ListSkeleton rows={2} /> : cards.map((card) => (
        <article key={card.id} style={{ padding: '12px 14px', borderTop: '0.5px solid var(--border-default)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: '0 0 5px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>{card.front}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{card.back}</p>
            {card.hint && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>Hint: {card.hint}</p>}
          </div>
          {canManageCard(card) && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" aria-label={`Edit card ${card.front}`} onClick={() => { setShowNewCard(false); setEditingCard(card) }} style={iconButton}><Pencil size={15} /></button>
              <button type="button" aria-label={`Delete card ${card.front}`} onClick={() => deleteCard.mutate(card.id)} style={iconButton}><Trash2 size={15} /></button>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

function CardForm({ initial, isPending, onCancel, onSubmit }: {
  initial: Flashcard | null
  isPending: boolean
  onCancel: () => void
  onSubmit: (input: { front: string; back: string; hint?: string | null }) => void
}) {
  const [front, setFront] = useState(initial?.front ?? '')
  const [back, setBack] = useState(initial?.back ?? '')
  const [hint, setHint] = useState(initial?.hint ?? '')

  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit({ front, back, hint: hint || null }) }} style={{ padding: 12, display: 'grid', gap: 8, borderTop: '0.5px solid var(--border-default)' }}>
      <textarea value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front" required rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
      <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back" required rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
      <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Hint" style={fieldStyle} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onCancel} style={controlButton}><X size={14} />Cancel</button>
        <button type="submit" disabled={isPending} style={{ ...controlButton, background: 'var(--uc-indigo)', color: 'var(--on-accent)', border: 'none' }}><Save size={14} />{initial ? 'Save' : 'Add card'}</button>
      </div>
    </form>
  )
}

function ReviewPanel({ groupId, deckId }: { groupId: string; deckId: string }) {
  const { data, isLoading } = useReviewQueue(groupId, deckId)
  const review = useReviewFlashcard(groupId, deckId)
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [scheduleConfirmation, setScheduleConfirmation] = useState<string | null>(null)
  const item = data?.items[index]

  function rate(rating: ReviewRating) {
    if (!item) return
    review.mutate({ cardId: item.id, rating }, {
      onSuccess: (result: FlashcardReviewResult) => {
        setScheduleConfirmation(formatScheduleConfirmation(result))
        setShowAnswer(false)
        setIndex((current) => current + 1)
      },
    })
  }

  return (
    <div style={{ padding: 12, borderTop: '0.5px solid var(--border-default)', background: 'var(--surface-raised)' }}>
      {isLoading ? (
        <div style={{ height: 88, borderRadius: 'var(--r-sm)', background: 'var(--surface-card)' }} />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {scheduleConfirmation && <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-mint)', fontWeight: 500 }}>{scheduleConfirmation}</p>}
          {item ? (
            <>
              <p style={{ margin: 0, minHeight: 48, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>{item.front}</p>
              {showAnswer && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <p style={{ margin: 0, minHeight: 44, fontSize: 13, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{item.back}</p>
                  {item.hint && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>Hint: {item.hint}</p>}
                </div>
              )}
              {showAnswer ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(64px, 1fr))', gap: 8 }}>
                  {(['again', 'hard', 'good', 'easy'] as const).map((rating) => (
                    <button key={rating} type="button" onClick={() => rate(rating)} disabled={review.isPending} style={controlButton}>
                      {rating === 'again' ? 'Again' : rating === 'hard' ? 'Hard' : rating === 'good' ? 'Good' : 'Easy'}
                    </button>
                  ))}
                </div>
              ) : (
                <button type="button" onClick={() => setShowAnswer(true)} style={{ ...controlButton, justifySelf: 'start' }}><RotateCcw size={14} />Show answer</button>
              )}
            </>
          ) : (
            <div style={{ minHeight: 88, display: 'grid', alignContent: 'center', gap: 4 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>All reviewed for now</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>No cards due</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatScheduleConfirmation(result: FlashcardReviewResult) {
  if (!result.dueAt) return 'Review saved'
  const diffMs = new Date(result.dueAt).getTime() - Date.now()
  if (!Number.isFinite(diffMs)) return 'Review saved'
  const minutes = Math.max(1, Math.round(diffMs / 60000))
  if (minutes < 60) return `Due in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Due in ${hours} ${hours === 1 ? 'hour' : 'hours'}`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

function DeckPlaceholder() {
  return (
    <section style={{ ...listSurface, minHeight: 220, display: 'grid', placeItems: 'center', padding: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No deck selected</p>
    </section>
  )
}
