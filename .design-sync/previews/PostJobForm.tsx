import { PostJobForm } from 'web';

export function EmptyForm() {
  return (
    <div style={{ minHeight: 600 }}>
      <PostJobForm onClose={() => {}} />
    </div>
  );
}
