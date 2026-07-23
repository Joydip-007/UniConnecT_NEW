import { useState } from 'react';
import { AnimatedTabBar } from 'web';

const tabs = [
  { value: 'feed', label: 'Feed' },
  { value: 'collab', label: 'Collaborations' },
  { value: 'notes', label: 'Study notes' },
  { value: 'decks', label: 'Flashcard decks' },
];

function Interactive({ initial }: { initial: string }) {
  const [active, setActive] = useState(initial);
  return (
    <div style={{ background: 'var(--surface-page)', width: 420 }}>
      <AnimatedTabBar tabs={tabs} active={active} onChange={setActive} />
    </div>
  );
}

export function FeedActive() {
  return <Interactive initial="feed" />;
}

export function CollabActive() {
  return <Interactive initial="collab" />;
}
