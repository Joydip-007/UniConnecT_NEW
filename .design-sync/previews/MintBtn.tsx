import { MintBtn } from 'web';

export function Default() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 24 }}>
      <MintBtn>Accept request</MintBtn>
      <MintBtn>Mark as resolved</MintBtn>
      <MintBtn disabled>Approving...</MintBtn>
    </div>
  );
}
