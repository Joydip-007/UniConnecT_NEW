import { ProfileSkills } from 'web';

const SKILLS = ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'System design', 'Docker', 'GraphQL'];

export function OwnProfile() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 380 }}>
      <ProfileSkills skills={SKILLS} isOwnProfile connectionStatus="connected" onEdit={() => {}} />
    </div>
  );
}

export function ConnectedViewer() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 380 }}>
      <ProfileSkills skills={SKILLS} isOwnProfile={false} connectionStatus="connected" onEdit={() => {}} />
    </div>
  );
}

export function RestrictedPreview() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 380 }}>
      <ProfileSkills skills={SKILLS} isOwnProfile={false} connectionStatus="none" onEdit={() => {}} />
    </div>
  );
}

export function Empty() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 380 }}>
      <ProfileSkills skills={[]} isOwnProfile connectionStatus="connected" onEdit={() => {}} />
    </div>
  );
}
