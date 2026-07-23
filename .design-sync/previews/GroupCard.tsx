import { GroupCard } from 'web';

const baseGroup = {
  id: 'grp-cs-club',
  name: 'CS Club — UIU',
  type: 'club' as const,
  description: 'Weekly workshops, hackathons, and a community for anyone into building things.',
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
    <div style={{ width: 340 }}>
      <GroupCard group={baseGroup} />
    </div>
  );
}

export function Joined() {
  return (
    <div style={{ width: 340 }}>
      <GroupCard
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
    <div style={{ width: 340 }}>
      <GroupCard
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

export function RestrictedAlumniOnly() {
  return (
    <div style={{ width: 340 }}>
      <GroupCard
        group={{
          ...baseGroup,
          id: 'grp-alumni-mentors',
          name: 'Alumni Mentors Circle',
          type: 'interest',
          description: null,
          memberCount: 58,
          allowedRole: 'alumni',
        }}
      />
    </div>
  );
}
