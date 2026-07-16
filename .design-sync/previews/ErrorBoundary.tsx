import { ErrorBoundary } from 'web';

function Boom(): JSX.Element {
  throw new Error('Preview error');
}

export function Default() {
  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    </div>
  );
}
