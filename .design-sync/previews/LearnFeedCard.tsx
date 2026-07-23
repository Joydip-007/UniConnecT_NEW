import { LearnFeedCard, dsQueryClient } from 'web';

// LearnFeedCard self-fetches via useToday(), keyed ['learning', 'today', {}].
// It renders null unless there's an entry with completedToday === false.
dsQueryClient.setQueryData(['learning', 'today', {}], [
  {
    pathId: 'path-web-fundamentals',
    completedToday: false,
    unit: {
      id: 'unit-css-flexbox',
      display_order: 4,
      title: 'CSS flexbox and grid layout',
      type: 'read',
      completed: false,
    },
  },
]);

export function TodaysUnitReady() {
  return (
    <div style={{ width: 320 }}>
      <LearnFeedCard />
    </div>
  );
}
