import { CollabTab, dsQueryClient } from 'web';

const group = {
  id: 'grp-cs-club',
  name: 'CS Club — UIU',
  type: 'club' as const,
  description: 'Weekly workshops, hackathons, and a community for anyone into building things.',
  avatarUrl: null,
  coverUrl: null,
  isPrivate: false,
  memberCount: 3,
  isMember: true,
  userRole: 'owner' as const,
  allowedRole: null,
  isSystem: false,
  department: null,
  createdBy: 'user-owner',
};

const collabPage = {
  page: 1,
  hasMore: false,
  items: [
    {
      id: 'job-1',
      title: 'Frontend intern — React',
      company: 'Pathao',
      location: 'Dhaka (hybrid)',
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 9).toISOString(),
      postedBy: { id: 'u-owner', fullName: 'Mahin Chowdhury' },
    },
    {
      id: 'job-2',
      title: 'Research assistant — NLP for Bangla',
      company: 'UIU Computational Linguistics Lab',
      location: 'On campus',
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
      postedBy: { id: 'u-admin', fullName: 'Nusrat Jahan' },
    },
  ],
};

// CollabTab fetches via useInfiniteQuery keyed on ['groups', 'collaborations', group.id].
dsQueryClient.setQueryData(['groups', 'collaborations', group.id], {
  pages: [collabPage],
  pageParams: [1],
});

export function Populated() {
  return (
    <div style={{ width: 420, padding: 12, background: 'var(--surface-page)' }}>
      <CollabTab group={group} />
    </div>
  );
}

const emptyGroup = { ...group, id: 'grp-empty' };
dsQueryClient.setQueryData(['groups', 'collaborations', emptyGroup.id], {
  pages: [{ page: 1, hasMore: false, items: [] }],
  pageParams: [1],
});

export function Empty() {
  return (
    <div style={{ width: 420, padding: 12, background: 'var(--surface-page)' }}>
      <CollabTab group={emptyGroup} />
    </div>
  );
}
