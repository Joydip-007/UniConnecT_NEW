import { AlumniCard } from 'web';

const alumnus = {
  id: 'alum-1',
  universityId: 'uni-1',
  fullName: 'Nadia Islam',
  headline: 'Senior Software Engineer at Brain Station 23',
  department: 'CSE',
  batchYear: '181',
  skills: ['React', 'Node.js', 'System design', 'Career growth', 'Interview prep'],
  avatarUrl: null,
  maxMentees: 3,
  currentMentees: 1,
};

export function Available() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 480 }}>
      <AlumniCard alumnus={alumnus} alreadySent={false} onAsk={() => {}} />
    </div>
  );
}

export function RequestAlreadySent() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 480 }}>
      <AlumniCard alumnus={alumnus} alreadySent onAsk={() => {}} />
    </div>
  );
}

export function AtCapacity() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 480 }}>
      <AlumniCard alumnus={{ ...alumnus, currentMentees: 3 }} alreadySent={false} onAsk={() => {}} />
    </div>
  );
}
