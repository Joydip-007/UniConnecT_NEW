import { useState } from 'react';
import { LeftSidebar } from 'web';

export function Expanded() {
  return (
    <div style={{ display: 'flex', height: 600 }}>
      <LeftSidebar collapsed={false} onToggleCollapsed={() => {}} />
    </div>
  );
}

export function Collapsed() {
  return (
    <div style={{ display: 'flex', height: 600 }}>
      <LeftSidebar collapsed={true} onToggleCollapsed={() => {}} />
    </div>
  );
}

export function Interactive() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ display: 'flex', height: 600 }}>
      <LeftSidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
    </div>
  );
}
