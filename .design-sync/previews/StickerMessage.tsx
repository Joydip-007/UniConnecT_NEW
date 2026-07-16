import { StickerMessage } from 'web';

export function Default() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)' }}>
      <StickerMessage url="https://media.klipy.com/sample/sticker-cat-wave.gif" />
    </div>
  );
}
