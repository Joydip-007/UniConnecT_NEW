import { PrimaryBtn } from 'web';

export function Default() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 24 }}>
      <PrimaryBtn>Save changes</PrimaryBtn>
      <PrimaryBtn>Connect</PrimaryBtn>
      <PrimaryBtn disabled>Sending...</PrimaryBtn>
    </div>
  );
}
