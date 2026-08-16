import { TrendingTagsWidget, dsQueryClient } from 'web';

// Seed on the SHARED dsQueryClient export (never @/ds-query-client — that is a
// different bundled instance and the widget would never leave its empty state).
// One story only: the query key is a fixed constant, so two cells on one card
// would share a single cache entry.

export function Default() {
  dsQueryClient.setQueryData(
    ['feed', 'trending'],
    [
      { name: 'placement2026', postCount: 42 },
      { name: 'thesisdefence', postCount: 27 },
      { name: 'uiudays', postCount: 18 },
      { name: 'hackathon', postCount: 11 },
      { name: 'internship', postCount: 9 },
    ],
  );
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <TrendingTagsWidget />
    </div>
  );
}
