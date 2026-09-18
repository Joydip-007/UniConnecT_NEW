import { MobileEventsStrip, dsQueryClient, useAuthStore } from 'web';

// The phone stand-in for the right rail's upcoming-events widget: display:none
// above 767px, so the card renders at a 390px viewport. Reads the same fixed
// ['events','list',{from:'today'}] key as the widget — one story.

useAuthStore.setState({
  user: { id: 'u1', username: 'nusrat.j', email: 'nusrat@uiu.ac.bd', role: 'student', universityId: 'uiu' },
  isLoading: false,
});
dsQueryClient.setQueryData(['events', 'list', { from: 'today' }], [
  { id: 'evt-1', title: 'Alumni networking night', location: 'UIU Auditorium', startsAt: '2024-05-16T12:30:00.000Z' },
  { id: 'evt-2', title: 'CSE thesis defence — Spring batch', location: 'Room 512', startsAt: '2024-05-19T04:00:00.000Z' },
  { id: 'evt-3', title: 'Career fair: 40+ hiring partners', location: null, startsAt: '2024-05-23T03:30:00.000Z' },
]);

export function OnAPhone() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <MobileEventsStrip />
    </div>
  );
}
