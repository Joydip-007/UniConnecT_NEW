import { PostReactionTrigger } from 'web';

export function Default() {
  return (
    <div style={{ padding: 48, background: 'var(--surface-page)' }}>
      <PostReactionTrigger onSelect={() => {}}>
        <button
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 'var(--r-pill)',
            border: '0.5px solid var(--border-default)',
            background: 'var(--surface-raised)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Like
        </button>
      </PostReactionTrigger>
    </div>
  );
}
