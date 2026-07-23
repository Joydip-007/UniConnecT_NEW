import { MemberRoleTag } from 'web';

export function AllRoles() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', display: 'flex', gap: 10, alignItems: 'center' }}>
      <MemberRoleTag role="owner" />
      <MemberRoleTag role="admin" />
      <MemberRoleTag role="moderator" />
      <MemberRoleTag role="member" />
    </div>
  );
}

export function OwnerHiddenInSystemGroup() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', display: 'flex', gap: 10, alignItems: 'center' }}>
      <MemberRoleTag role="owner" hideOwner />
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>(renders nothing — official group)</span>
    </div>
  );
}
