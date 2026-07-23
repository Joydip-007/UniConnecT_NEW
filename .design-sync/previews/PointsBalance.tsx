import { PointsBalance } from 'web';

export function Zero() {
  return <PointsBalance points={0} />;
}

export function Earned() {
  return <PointsBalance points={120} />;
}

export function LargeBalance() {
  return <PointsBalance points={4850} />;
}
