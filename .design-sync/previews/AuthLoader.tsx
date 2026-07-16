import { AuthLoader } from 'web';

// AuthLoader wraps children and, on mount, attempts a POST /auth/refresh via
// axios if `uc:has_session` is set in localStorage. In this sandbox there's no
// backend, so the request will fail/hang harmlessly and the component falls
// back to rendering its children once loading resolves (or immediately, since
// no prior session exists in a fresh preview environment — isLoading defaults
// based on the authStore's initial state).
export function Default() {
  return (
    <div style={{ padding: 24 }}>
      <AuthLoader>
        <div
          style={{
            padding: 24,
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            color: 'var(--text-primary)',
            fontSize: 14,
          }}
        >
          App content rendered by AuthLoader's children once auth resolves.
        </div>
      </AuthLoader>
    </div>
  );
}
