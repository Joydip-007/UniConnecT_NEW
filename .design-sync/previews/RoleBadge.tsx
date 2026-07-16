import { RoleBadge } from 'web';

export function AllRoles() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 24 }}>
      <RoleBadge role="student" showTooltip={false} />
      <RoleBadge role="alumni" showTooltip={false} />
      <RoleBadge role="faculty" showTooltip={false} />
      <RoleBadge role="admin" showTooltip={false} />
      <RoleBadge role="driver" showTooltip={false} />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 24 }}>
      <RoleBadge role="alumni" size={14} showTooltip={false} />
      <RoleBadge role="alumni" size={20} showTooltip={false} />
      <RoleBadge role="alumni" size={28} showTooltip={false} />
    </div>
  );
}
