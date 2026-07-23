import { FeaturedAlumni } from 'web';

export function Populated() {
  return (
    <div style={{ padding: 12, display: 'flex', gap: 10 }}>
      <FeaturedAlumni
        alumni={[
          { id: 'a1', fullName: 'Nabila Rahman', avatarUrl: null, headline: 'Product Designer at Pathao', department: 'Computer Science & Engineering', batchYear: 2019 },
          { id: 'a2', fullName: 'Rezaul Karim', avatarUrl: null, headline: 'Software Engineer at Google', department: 'Computer Science & Engineering', batchYear: 2017 },
        ]}
      />
    </div>
  );
}

export function Empty() {
  return (
    <div style={{ padding: 12 }}>
      <FeaturedAlumni alumni={[]} />
    </div>
  );
}
