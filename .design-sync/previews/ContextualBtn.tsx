import { ContextualBtn } from 'web';
import { Plus, Filter } from 'lucide-react';

export function Default() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 24 }}>
      <ContextualBtn icon={<Plus size={15} />}>Add experience</ContextualBtn>
      <ContextualBtn icon={<Filter size={15} />}>Filter results</ContextualBtn>
    </div>
  );
}
