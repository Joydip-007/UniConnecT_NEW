export const POINTS_PER_SESSION = 10
export const POINTS_PER_USD = 100

export function formatUsdCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`
}

export function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
