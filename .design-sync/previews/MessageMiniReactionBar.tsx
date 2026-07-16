import { MessageMiniReactionBar } from 'web';

export function Default() {
  return (
    <div style={{ display: 'flex', gap: 16, padding: 24, background: 'var(--surface-page)' }}>
      <MessageMiniReactionBar onSelect={() => {}} myReaction={null} />
      <MessageMiniReactionBar onSelect={() => {}} myReaction="love" />
    </div>
  );
}
