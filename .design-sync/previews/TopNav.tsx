import { TopNav } from 'web';

// TopNav reads auth/notifications state from Zustand stores and fires a useQuery
// for search/notification data via axios — no backend in this sandbox, so it
// renders its default logged-out/empty-state chrome (logo, search, icon buttons).
export function Default() {
  return (
    <div style={{ minHeight: 64 }}>
      <TopNav />
    </div>
  );
}
