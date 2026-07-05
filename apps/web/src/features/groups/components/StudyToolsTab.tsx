import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  BookOpen,
  FileText,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import {
  useCreateFlashcard,
  useCreateFlashcardDeck,
  useCreateSharedNote,
  useDeleteSharedNote,
  useFlashcardDecks,
  useFlashcards,
  useReviewFlashcard,
  useReviewQueue,
  useSharedNotes,
  useUpdateSharedNote,
} from '../hooks/useGroupExtended'
import type { FlashcardDeck, MemberRole, ReviewRating, SharedNote } from '../types'
import { StudySessionsTab } from './StudySessionsTab'

type StudyMode = 'sessions' | 'decks' | 'notes'

const controlButton = {
  minHeight: 44,
  padding: '8px 14px',
  borderRadius: 'var(--r-pill)',
  border: '0.5px solid var(--border-default)',
  background: 'var(--surface-raised)',
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  transitionProperty: 'background-color, color, border-color, transform',
  transitionDuration: '150ms',
} as const

const iconButton = {
  minWidth: 44,
  minHeight: 44,
  borderRadius: 'var(--r-pill)',
  border: '0.5px solid var(--border-default)',
  background: 'var(--surface-raised)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transitionProperty: 'background-color, color, border-color, transform',
  transitionDuration: '150ms',
} as const

const fieldStyle = {
  minHeight: 44,
  width: '100%',
  padding: '9px 12px',
  borderRadius: 'var(--r-sm)',
  border: '0.5px solid var(--border-default)',
  background: 'var(--surface-raised)',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontWeight: 400,
  outline: 'none',
  boxSizing: 'border-box',
} as const

const listSurface = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  overflow: 'hidden',
} as const

export function StudyToolsTab({ groupId, currentUserId, userRole }: {
  groupId: string
  currentUserId?: string
  userRole: MemberRole | null
}) {
  const [mode, setMode] = useState<StudyMode>('sessions')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role="tablist" aria-label="Study tools" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['sessions', 'decks', 'notes'] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => setMode(item)}
            className="press-feedback"
            style={{
              ...controlButton,
              background: mode === item ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
              color: mode === item ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
              minWidth: 96,
            }}
          >
            {item === 'sessions' ? 'Sessions' : item === 'decks' ? 'Decks' : 'Notes'}
          </button>
        ))}
      </div>
      {mode === 'sessions' && <StudySessionsTab groupId={groupId} currentUserId={currentUserId} showCreateAction />}
      {mode === 'decks' && <DecksPanel groupId={groupId} />}
      {mode === 'notes' && <NotesPanel groupId={groupId} currentUserId={currentUserId} userRole={userRole} />}
    </div>
  )
}

function DecksPanel({ groupId }: { groupId: string }) {
  const { data: decks = [], isLoading } = useFlashcardDecks(groupId)
  const createDeck = useCreateFlashcardDeck(groupId)
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [showNewDeck, setShowNewDeck] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const activeDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId) ?? decks[0] ?? null,
    [decks, selectedDeckId],
  )

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
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : decks.length === 0 ? (
          <EmptyState title="No decks yet" actionLabel="New deck" onAction={() => setShowNewDeck(true)} />
        ) : (
          decks.map((deck, index) => (
            <DeckRow key={deck.id} deck={deck} selected={activeDeck?.id === deck.id} first={index === 0} onSelect={() => setSelectedDeckId(deck.id)} />
          ))
        )}
      </section>
      {activeDeck ? <DeckDetailPanel groupId={groupId} deck={activeDeck} /> : <DeckPlaceholder />}
    </div>
  )
}

function DeckRow({ deck, selected, first, onSelect }: { deck: FlashcardDeck; selected: boolean; first: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="press-feedback"
      style={{
        width: '100%',
        minHeight: 72,
        padding: '12px 14px',
        border: 'none',
        borderTop: first ? 'none' : '0.5px solid var(--border-default)',
        background: selected ? 'var(--uc-indigo-bg)' : 'transparent',
        color: 'inherit',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
        textAlign: 'left',
        cursor: 'pointer',
        transitionProperty: 'background-color, transform',
        transitionDuration: '150ms',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', marginBottom: 3, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>{deck.title}</span>
        {deck.description && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{deck.description}</span>}
      </span>
      <span style={{ display: 'flex', gap: 8, color: 'var(--text-tertiary)', fontSize: 12, fontVariantNumeric: 'tabular-nums', alignItems: 'center' }}>
        <span>{deck.cardCount} cards</span>
        <span>{deck.dueCount} due</span>
      </span>
    </button>
  )
}

function DeckDetailPanel({ groupId, deck }: { groupId: string; deck: FlashcardDeck }) {
  const { data: cards = [], isLoading } = useFlashcards(groupId, deck.id)
  const createCard = useCreateFlashcard(groupId, deck.id)
  const [showNewCard, setShowNewCard] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')

  function submitCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createCard.mutate({ front, back }, {
      onSuccess: () => {
        setFront('')
        setBack('')
        setShowNewCard(false)
      },
    })
  }

  return (
    <section style={{ ...listSurface, minHeight: 280 }}>
      <PanelHeader title={deck.title} icon={<BookOpen size={16} strokeWidth={1.7} />} actionLabel="New card" onAction={() => setShowNewCard(true)} />
      <ReviewPanel groupId={groupId} deckId={deck.id} />
      {showNewCard && (
        <form onSubmit={submitCard} style={{ padding: 12, display: 'grid', gap: 8, borderTop: '0.5px solid var(--border-default)' }}>
          <textarea value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front" required rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
          <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back" required rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowNewCard(false)} style={controlButton}><X size={14} />Cancel</button>
            <button type="submit" disabled={createCard.isPending} style={{ ...controlButton, background: 'var(--uc-indigo)', color: 'var(--on-accent)', border: 'none' }}><Save size={14} />Add card</button>
          </div>
        </form>
      )}
      {isLoading ? <ListSkeleton rows={2} /> : cards.map((card, index) => (
        <div key={card.id} style={{ padding: '12px 14px', borderTop: index === 0 ? '0.5px solid var(--border-default)' : '0.5px solid var(--border-default)' }}>
          <p style={{ margin: '0 0 5px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>{card.front}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{card.back}</p>
        </div>
      ))}
    </section>
  )
}

function ReviewPanel({ groupId, deckId }: { groupId: string; deckId: string }) {
  const { data, isLoading } = useReviewQueue(groupId, deckId)
  const review = useReviewFlashcard(groupId, deckId)
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const item = data?.items[index]

  function rate(rating: ReviewRating) {
    if (!item) return
    review.mutate({ cardId: item.id, rating })
    setShowAnswer(false)
    setIndex((current) => Math.min(current + 1, Math.max((data?.items.length ?? 1) - 1, 0)))
  }

  return (
    <div style={{ padding: 12, borderTop: '0.5px solid var(--border-default)', background: 'var(--surface-raised)' }}>
      {isLoading ? (
        <div style={{ height: 88, borderRadius: 'var(--r-sm)', background: 'var(--surface-card)' }} />
      ) : item ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <p style={{ margin: 0, minHeight: 48, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>{item.front}</p>
          {showAnswer && <p style={{ margin: 0, minHeight: 44, fontSize: 13, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{item.back}</p>}
          {showAnswer ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(64px, 1fr))', gap: 8 }}>
              {(['again', 'hard', 'good', 'easy'] as const).map((rating) => (
                <button key={rating} type="button" onClick={() => rate(rating)} style={controlButton}>
                  {rating === 'again' ? 'Again' : rating === 'hard' ? 'Hard' : rating === 'good' ? 'Good' : 'Easy'}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" onClick={() => setShowAnswer(true)} style={{ ...controlButton, justifySelf: 'start' }}><RotateCcw size={14} />Show answer</button>
          )}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No cards due</p>
      )}
    </div>
  )
}

function NotesPanel({ groupId, currentUserId, userRole }: { groupId: string; currentUserId?: string; userRole: MemberRole | null }) {
  const { data, isLoading } = useSharedNotes(groupId)
  const createNote = useCreateSharedNote(groupId)
  const updateNote = useUpdateSharedNote(groupId)
  const deleteNote = useDeleteSharedNote(groupId)
  const [editing, setEditing] = useState<SharedNote | null>(null)
  const [showNewNote, setShowNewNote] = useState(false)
  const notes = data?.items ?? []
  const canManageAll = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator'

  return (
    <section style={listSurface}>
      <PanelHeader title="Notes" icon={<FileText size={16} strokeWidth={1.7} />} actionLabel="New note" onAction={() => { setEditing(null); setShowNewNote(true) }} />
      {(showNewNote || editing) && (
        <NoteForm
          initial={editing}
          isPending={createNote.isPending || updateNote.isPending}
          onCancel={() => { setShowNewNote(false); setEditing(null) }}
          onSubmit={(input) => {
            if (editing) updateNote.mutate({ noteId: editing.id, input }, { onSuccess: () => setEditing(null) })
            else createNote.mutate(input, { onSuccess: () => setShowNewNote(false) })
          }}
        />
      )}
      {isLoading ? <ListSkeleton rows={3} /> : notes.length === 0 ? (
        <EmptyState title="No shared notes yet" actionLabel="New note" onAction={() => setShowNewNote(true)} />
      ) : notes.map((note, index) => {
        const canEdit = canManageAll || note.createdBy === currentUserId
        return (
          <article key={note.id} style={{ padding: '12px 14px', borderTop: index === 0 ? '0.5px solid var(--border-default)' : '0.5px solid var(--border-default)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>{note.title}</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>{note.body}</p>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" aria-label={`Edit ${note.title}`} onClick={() => { setShowNewNote(false); setEditing(note) }} style={iconButton}><Pencil size={15} /></button>
                <button type="button" aria-label={`Delete ${note.title}`} onClick={() => deleteNote.mutate(note.id)} style={iconButton}><Trash2 size={15} /></button>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}

function NoteForm({ initial, isPending, onCancel, onSubmit }: { initial: SharedNote | null; isPending: boolean; onCancel: () => void; onSubmit: (input: { title: string; body: string }) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit({ title, body }) }} style={{ padding: 12, display: 'grid', gap: 8, borderTop: '0.5px solid var(--border-default)' }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" required style={fieldStyle} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Note" required rows={4} style={{ ...fieldStyle, resize: 'vertical' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onCancel} style={controlButton}><X size={14} />Cancel</button>
        <button type="submit" disabled={isPending} style={{ ...controlButton, background: 'var(--uc-indigo)', color: 'var(--on-accent)', border: 'none' }}><Save size={14} />{initial ? 'Save' : 'Create'}</button>
      </div>
    </form>
  )
}

function PanelHeader({ title, icon, actionLabel, onAction }: { title: string; icon: ReactNode; actionLabel: string; onAction: () => void }) {
  return (
    <div style={{ minHeight: 58, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <h3 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>{icon}{title}</h3>
      <button type="button" onClick={onAction} style={controlButton}><Plus size={14} />{actionLabel}</button>
    </div>
  )
}

function EmptyState({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) {
  return (
    <div style={{ minHeight: 150, padding: 16, borderTop: '0.5px solid var(--border-default)', display: 'grid', placeItems: 'center', gap: 10, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>{title}</p>
      <button type="button" onClick={onAction} style={controlButton}><Plus size={14} />{actionLabel}</button>
    </div>
  )
}

function DeckPlaceholder() {
  return (
    <section style={{ ...listSurface, minHeight: 220, display: 'grid', placeItems: 'center', padding: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No deck selected</p>
    </section>
  )
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ height: 68, padding: 12, borderTop: index === 0 ? '0.5px solid var(--border-default)' : '0.5px solid var(--border-default)' }}>
          <div style={{ height: 14, width: '54%', marginBottom: 8, borderRadius: 'var(--r-sm)', background: 'var(--surface-raised)' }} />
          <div style={{ height: 12, width: '34%', borderRadius: 'var(--r-sm)', background: 'var(--surface-raised)' }} />
        </div>
      ))}
    </>
  )
}
