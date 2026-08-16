import { CreateEventForm, useAuthStore } from 'web';

// The form gates on role: anything but faculty/admin renders only the
// "Only faculty and admins can create events" permission screen. Seed a faculty
// user from the SHARED 'web' export — that re-export lives inside the synth
// entry, so it is the same store instance the component subscribes to. (An
// `extraEntries` copy is NOT: esbuild realpaths it to a different module record
// and seeding does nothing.) setState, not setAuth() — the latter writes
// localStorage and opens a socket.
useAuthStore.setState({
  isLoading: false,
  accessToken: 'ds-preview-token',
  user: {
    id: 'u-faculty',
    username: 'skarim',
    email: 'skarim@uiu.ac.bd',
    role: 'faculty',
    universityId: 'uni-uiu',
    isVerified: true,
    themePreference: 'dark',
    profile: {
      fullName: 'Dr. Sadia Karim',
      bio: null,
      avatarUrl: null,
      coverUrl: null,
      headline: 'Associate Professor, CSE',
      department: 'Computer Science & Engineering',
      batchYear: null,
      linkedinUrl: null,
      phone: null,
      skills: [],
      isOpenToWork: false,
      isOpenToMentorship: false,
      mentorshipPoints: 0,
      maxMentees: 3,
      location: 'Dhaka',
      websiteUrl: null,
      githubUrl: null,
      portfolioUrl: null,
      isOpenToMsg: true,
    },
  },
});

// The form is a bare `position: fixed; inset: 0` overlay — it is NOT portalled
// through Modal the way EditProfileModal is. Returned bare, the preview root has
// no height for the capture to measure and the card crops to a ~40px sliver of
// the backdrop. An explicit sized shell is what gives the capture something to
// measure; the viewport override alone does not fix it.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', width: 680, height: 780, background: 'var(--surface-page)' }}>
      {children}
    </div>
  );
}

export function CreateNew() {
  return (
    <Shell>
      <CreateEventForm onClose={() => {}} />
    </Shell>
  );
}

export function EditExisting() {
  return (
    <Shell>
    <CreateEventForm
      onClose={() => {}}
      initial={{
        id: 'event-9',
        title: 'Spring 2026 career fair',
        type: 'career_fair',
        description: 'Meet recruiters from 40+ companies across tech, finance, and telecom on the UIU permanent campus.',
        isOnline: false,
        location: 'UIU Campus, Madani Ave, Dhaka',
        onlineLink: '',
        startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(),
        capacity: 500,
        coverUrl: 'https://picsum.photos/seed/career-fair/800/400',
        isPublished: true,
        attachments: [],
      }}
    />
    </Shell>
  );
}
