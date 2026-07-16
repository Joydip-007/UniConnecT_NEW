import { StickerDrawer } from 'web';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export function Default() {
  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ padding: 16, background: 'var(--surface-page)' }}>
        <StickerDrawer onSelect={() => {}} onClose={() => {}} />
      </div>
    </QueryClientProvider>
  );
}
