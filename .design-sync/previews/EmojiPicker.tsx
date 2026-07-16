import { EmojiPicker } from 'web';

export function Default() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)' }}>
      <EmojiPicker onSelect={() => {}} onClose={() => {}} />
    </div>
  );
}
