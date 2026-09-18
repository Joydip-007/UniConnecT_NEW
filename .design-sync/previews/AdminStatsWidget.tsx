import { AdminStatsWidget, dsQueryClient } from 'web';

// Route-aware scoreboard. Outside /admin the rail resolves to the Insights
// payload, which reads ['admin','stats'] — one fixed key, so one story.
// Dates sit on the frozen capture clock (2024-05-15) so "Posts today" is real.

const STATS = {
  users: 4812,
  activeUsers: 1963,
  postsByDay: [
    { date: "2024-05-09", count: 41 }, { date: "2024-05-10", count: 38 }, { date: "2024-05-11", count: 22 },
    { date: "2024-05-12", count: 19 }, { date: "2024-05-13", count: 47 }, { date: "2024-05-14", count: 52 },
    { date: "2024-05-15", count: 17 },
  ],
  usersByRole: [{ role: "student", count: 4100 }, { role: "alumni", count: 520 }, { role: "faculty", count: 180 }, { role: "admin", count: 12 }],
  escalatedReports: 3,
  deletionRequests: 1,
  resolvedPct7d: 92,
  pendingInviteBatches: 2,
  moderationHealth: { reportsOpen: 7, resolvedPct7d: 92, medianResponseHours: 5, repeatOffenders: 2 },
};
dsQueryClient.setQueryData(["admin", "stats"], STATS);
dsQueryClient.setQueryData(["content-sync", "pending"], { news: [{ id: "n1" }, { id: "n2" }], events: [{ id: "e1" }] });

export function CampusInsights() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <AdminStatsWidget />
    </div>
  );
}
