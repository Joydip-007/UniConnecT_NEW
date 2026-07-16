import { EmptyState } from 'web';
import { Inbox, SearchX } from 'lucide-react';

export function Basic() {
  return (
    <div style={{ width: 360 }}>
      <EmptyState
        icon={Inbox}
        title="No messages yet"
        description="When you start a conversation, it will show up here."
      />
    </div>
  );
}

export function WithAction() {
  return (
    <div style={{ width: 360 }}>
      <EmptyState
        icon={SearchX}
        title="No results found"
        description="Try adjusting your filters"
        action={{ label: 'Clear filters', onClick: () => {} }}
      />
    </div>
  );
}
