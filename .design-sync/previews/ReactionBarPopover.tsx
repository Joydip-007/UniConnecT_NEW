import { ReactionBarPopover } from 'web';

export function Default() {
  return (
    <div style={{ padding: 24, background: 'var(--surface-page)' }}>
      <ReactionBarPopover onSelect={() => {}} onClose={() => {}} />
    </div>
  );
}
