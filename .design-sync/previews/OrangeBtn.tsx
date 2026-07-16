import { OrangeBtn } from 'web';

export function Default() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 24 }}>
      <OrangeBtn>Apply now</OrangeBtn>
      <OrangeBtn>Post job</OrangeBtn>
      <OrangeBtn disabled>Submitting...</OrangeBtn>
    </div>
  );
}
