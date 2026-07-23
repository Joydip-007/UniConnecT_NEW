import { CreateEventForm } from 'web';

export function CreateNew() {
  return <CreateEventForm onClose={() => {}} />;
}

export function EditExisting() {
  return (
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
  );
}
