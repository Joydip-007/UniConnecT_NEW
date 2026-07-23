import { RedemptionHistoryList } from 'web';

const history = [
  {
    id: 'r1',
    pointsSpent: 500,
    status: 'fulfilled' as const,
    codeText: 'AMZN-7X2K-9QLP',
    adminNote: null,
    requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    fulfilledAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    giftCard: { id: 'gc1', vendor: 'Amazon', title: 'Amazon gift card', valueUsdCents: 1000, imageUrl: null },
  },
  {
    id: 'r2',
    pointsSpent: 250,
    status: 'pending' as const,
    codeText: null,
    adminNote: null,
    requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    fulfilledAt: null,
    giftCard: { id: 'gc2', vendor: 'Starbucks', title: 'Starbucks gift card', valueUsdCents: 500, imageUrl: null },
  },
  {
    id: 'r3',
    pointsSpent: 300,
    status: 'rejected' as const,
    codeText: null,
    adminNote: 'Insufficient point balance verified at review time — points were refunded.',
    requestedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    fulfilledAt: null,
    giftCard: { id: 'gc3', vendor: 'Google Play', title: 'Google Play credit', valueUsdCents: 750, imageUrl: null },
  },
];

export function Populated() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 420 }}>
      <RedemptionHistoryList history={history} />
    </div>
  );
}

export function SingleFulfilled() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 420 }}>
      <RedemptionHistoryList history={[history[0]]} />
    </div>
  );
}
