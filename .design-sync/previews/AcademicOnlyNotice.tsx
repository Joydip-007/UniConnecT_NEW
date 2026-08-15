import { AcademicOnlyNotice } from 'web';

// The gate shown inside a group tab when the feature only applies to
// `type: 'academic'` groups. Both props are required: a sentence and an emoji.

export function Flashcards() {
  return (
    <div style={{ background: 'var(--surface-card)', width: 420 }}>
      <AcademicOnlyNotice
        icon={'\u{1F9E0}'}
        message="Flashcard decks are available in academic groups only. Ask a group admin to switch this group's type to unlock them."
      />
    </div>
  );
}

export function Gradebook() {
  return (
    <div style={{ background: 'var(--surface-card)', width: 420 }}>
      <AcademicOnlyNotice
        icon={'\u{1F4CA}'}
        message="The gradebook is an academic-group feature."
      />
    </div>
  );
}
