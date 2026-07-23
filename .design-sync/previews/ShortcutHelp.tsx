import { ShortcutHelp } from 'web';

// ShortcutHelp renders a native <dialog> and calls showModal() itself based on
// `open` — force it open so the card captures the visible cheatsheet.
export function Open() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', minHeight: 320 }}>
      <ShortcutHelp open onClose={() => {}} />
    </div>
  );
}
