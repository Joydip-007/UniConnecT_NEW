import { ProfileProgressWidget, dsQueryClient } from 'web';

// Seed on the SHARED dsQueryClient export (never @/ds-query-client — a different
// bundled instance, and the widget would sit in its skeleton state forever).
// One story only: the query key is a fixed constant, so two cells on one card
// would share a single cache entry and the last render would win for both.
//
// The data is deliberately INCOMPLETE — the widget self-hides once every step is
// done, so a finished profile would render nothing at all.

export function Default() {
  dsQueryClient.setQueryData(['users', 'me', 'progress'], {
    profileScore: 70,
    hasMadePost: true,
    connectionCount: 6,
    isVerified: false,
  });
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <ProfileProgressWidget />
    </div>
  );
}
