import { FeedLayout } from 'web';

// FeedLayout renders TopNav/LeftSidebar/RightSidebar/MobileBottomNav around a
// react-router <Outlet/>, which resolves to nothing outside a matched route —
// the shell chrome itself is still fully visible.
export function Default() {
  return (
    <div style={{ height: 800 }}>
      <FeedLayout />
    </div>
  );
}
