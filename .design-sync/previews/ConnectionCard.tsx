import { ConnectionCard } from 'web';

const base = {
  padding: 12,
};

export function Default() {
  return (
    <div style={base}>
      <ConnectionCard
        connection={{
          id: 'conn-1',
          status: 'accepted',
          user: {
            id: 'user-nabila',
            fullName: 'Nabila Rahman',
            role: 'alumni',
            headline: 'Product Designer at Pathao',
            avatarUrl: null,
          },
        }}
      />
    </div>
  );
}

export function WithDepartmentNoHeadline() {
  return (
    <div style={base}>
      <ConnectionCard
        connection={{
          id: 'conn-2',
          status: 'accepted',
          user: {
            id: 'user-tanvir',
            fullName: 'Tanvir Ahmed',
            role: 'student',
            department: 'Computer Science & Engineering',
            avatarUrl: null,
          },
        }}
      />
    </div>
  );
}

export function LongName() {
  return (
    <div style={base}>
      <ConnectionCard
        connection={{
          id: 'conn-3',
          status: 'accepted',
          user: {
            id: 'user-faisal',
            fullName: 'Md. Faisal Hossain Chowdhury',
            role: 'faculty',
            headline: 'Associate Professor, Department of CSE',
            avatarUrl: null,
          },
        }}
      />
    </div>
  );
}
