import { ReactionBtn } from 'web';

export function ActiveStates() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 24, background: 'var(--surface-page)' }}>
      <ReactionBtn active={false}>Like</ReactionBtn>
      <ReactionBtn active activeTone="indigo">Like</ReactionBtn>
      <ReactionBtn active activeTone="orange">Celebrate</ReactionBtn>
    </div>
  );
}
