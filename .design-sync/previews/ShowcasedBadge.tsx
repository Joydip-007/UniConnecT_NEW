import { ShowcasedBadge, dsQueryClient } from 'web';

// ShowcasedBadge fetches via useUserBadges(userId), keyed ['learning', 'badges', { userId }].
dsQueryClient.setQueryData(['learning', 'badges', { userId: 'u-with-badge' }], [
  {
    id: 'badge-web-foundations',
    name: 'Web Foundations',
    description: 'Completed the Web Development Fundamentals path',
    iconUrl: null,
    category: 'path',
    points: 50,
    rarity: 'rare',
    isShowcased: true,
    awardedAt: new Date().toISOString(),
    skillPathId: 'path-web-fundamentals',
  },
]);

dsQueryClient.setQueryData(['learning', 'badges', { userId: 'u-no-showcase' }], [
  {
    id: 'badge-streak-7',
    name: '7-day streak',
    description: 'Studied 7 days in a row',
    iconUrl: null,
    category: 'streak',
    points: 20,
    rarity: 'common',
    isShowcased: false,
    awardedAt: new Date().toISOString(),
    skillPathId: null,
  },
]);

export function NextToName() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Nusrat Jahan</span>
      <ShowcasedBadge userId="u-with-badge" size={18} />
    </div>
  );
}

export function NoShowcasedBadge() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Rafiul Islam</span>
      <ShowcasedBadge userId="u-no-showcase" size={18} />
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>(renders nothing — no showcased badge)</span>
    </div>
  );
}
