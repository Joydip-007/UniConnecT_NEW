import { AllowedRoleBadge } from 'web';

export function Student() {
  return <AllowedRoleBadge allowedRole="student" />;
}

export function Alumni() {
  return <AllowedRoleBadge allowedRole="alumni" />;
}

export function Faculty() {
  return <AllowedRoleBadge allowedRole="faculty" />;
}

export function NoRestriction() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        (renders nothing when allowedRole is null)
      </span>
    </div>
  );
}
