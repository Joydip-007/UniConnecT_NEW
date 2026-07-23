import { ActiveGroups } from 'web';

export function Populated() {
  return (
    <div style={{ padding: 12, display: 'flex', gap: 10 }}>
      <ActiveGroups
        groups={[
          { id: 'grp-1', name: 'CSE Batch 213', memberCount: 214, recentPostCount: 18 },
          { id: 'grp-2', name: 'Robotics & AI Club', memberCount: 87, recentPostCount: 6 },
          { id: 'grp-3', name: 'Photography Society', memberCount: 132, recentPostCount: 11 },
        ]}
      />
    </div>
  );
}

export function Empty() {
  return (
    <div style={{ padding: 12 }}>
      <ActiveGroups groups={[]} />
    </div>
  );
}
