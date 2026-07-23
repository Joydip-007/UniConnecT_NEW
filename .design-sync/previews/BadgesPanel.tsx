import { BadgesPanel, dsQueryClient } from 'web';

const BADGES = [
  {
    id: 'badge-1',
    name: 'Early Adopter',
    rarity: 'rare' as const,
    iconUrl: '\u{1F680}',
    awardedAt: '2024-09-10T00:00:00.000Z',
    isShowcased: true,
  },
  {
    id: 'badge-2',
    name: 'Course Completionist',
    rarity: 'epic' as const,
    iconUrl: '\u{1F3C6}',
    awardedAt: '2024-11-02T00:00:00.000Z',
    isShowcased: false,
  },
  {
    id: 'badge-3',
    name: 'Profile Complete',
    rarity: 'common' as const,
    iconUrl: null,
    awardedAt: '2024-08-21T00:00:00.000Z',
    isShowcased: false,
  },
];

function seed(userId: string, badges: typeof BADGES) {
  dsQueryClient.setQueryData(['learning', 'badges', { userId }], badges);
}

export function OwnProfileWithBadges() {
  seed('user-own', BADGES);
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <BadgesPanel userId="user-own" isOwnProfile />
    </div>
  );
}

export function OtherProfileWithBadges() {
  seed('user-other', BADGES);
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <BadgesPanel userId="user-other" isOwnProfile={false} />
    </div>
  );
}

export function Empty() {
  seed('user-empty', []);
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <BadgesPanel userId="user-empty" isOwnProfile={false} />
    </div>
  );
}
