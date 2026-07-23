import { GroupHeader } from 'web';

const baseGroup = {
  id: 'grp-cs-club',
  name: 'CS Club — UIU',
  type: 'club' as const,
  description: 'Weekly workshops, hackathons, and a community for anyone into building things on campus.',
  avatarUrl: null,
  coverUrl: null,
  isPrivate: false,
  memberCount: 482,
  isMember: false,
  userRole: null,
  allowedRole: null,
  isSystem: false,
  department: null,
  createdBy: 'user-1',
};

export function NotJoined() {
  return (
    <div style={{ width: 480 }}>
      <GroupHeader group={baseGroup} />
    </div>
  );
}

export function JoinedMember() {
  return (
    <div style={{ width: 480 }}>
      <GroupHeader
        group={{
          ...baseGroup,
          id: 'grp-cse-batch-211',
          name: 'CSE 211 Batch',
          type: 'batch',
          description: 'Official batch group for CSE Trimester 211 students.',
          memberCount: 96,
          isMember: true,
          userRole: 'member',
        }}
      />
    </div>
  );
}

export function OfficialSystemGroup() {
  return (
    <div style={{ width: 480 }}>
      <GroupHeader
        group={{
          ...baseGroup,
          id: 'grp-dept-cse',
          name: 'Department of CSE',
          type: 'department',
          description: 'Official department-wide group — membership syncs automatically with your enrollment.',
          memberCount: 3120,
          isMember: true,
          userRole: 'member',
          isSystem: true,
          allowedRole: 'student',
        }}
      />
    </div>
  );
}

export function WithCoverImage() {
  return (
    <div style={{ width: 480 }}>
      <GroupHeader
        group={{
          ...baseGroup,
          id: 'grp-research-ml',
          name: 'Applied ML Research Group',
          type: 'research',
          description: 'Reading groups, paper discussions, and collaborative research projects.',
          coverUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=200&fit=crop',
          memberCount: 214,
        }}
      />
    </div>
  );
}
