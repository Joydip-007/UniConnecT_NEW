import { GroupTabRail } from 'web';

// The group detail page's section switcher. Tab values pick their glyph; a
// numeric badge marks pending join requests for admins.

const TABS = [
  { value: 'feed', label: 'Feed' },
  { value: 'about', label: 'About' },
  { value: 'members', label: 'Members' },
  { value: 'resources', label: 'Resources' },
  { value: 'sessions', label: 'Study sessions' },
];

export function MemberView() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 720 }}>
      <GroupTabRail tabs={TABS} active="feed" onChange={() => {}} />
    </div>
  );
}

export function AdminWithPendingRequests() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 720 }}>
      <GroupTabRail tabs={[...TABS, { value: 'requests', label: 'Requests', badge: 4 }]} active="members" onChange={() => {}} />
    </div>
  );
}
