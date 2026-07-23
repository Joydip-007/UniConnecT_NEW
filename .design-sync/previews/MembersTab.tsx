import { MembersTab, dsQueryClient } from 'web';

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

// MembersTab fetches via useInfiniteQuery keyed on [group.id, debounced search, roleFilter].
// Seed the empty-search/no-filter page since that's the default render state.
dsQueryClient.setQueryData(['groups', 'members', group.id, '', ''], {
  pages: [
    {
      page: 1,
      hasMore: false,
      items: [
        { id: 'u-owner', fullName: 'Mahin Chowdhury', avatarUrl: null, role: 'owner', headline: 'Club founder', department: 'CSE' },
        { id: 'u-admin', fullName: 'Nusrat Jahan', avatarUrl: null, role: 'admin', headline: null, department: 'CSE' },
        { id: 'u-member', fullName: 'Rafiul Islam', avatarUrl: null, role: 'member', headline: 'Loves competitive programming', department: 'CSE' },
      ],
    },
  ],
  pageParams: [1],
});

export function PopulatedList() {
  return (
    <div style={{ width: 420, padding: 12, background: 'var(--surface-page)' }}>
      <MembersTab group={group} />
    </div>
  );
}
