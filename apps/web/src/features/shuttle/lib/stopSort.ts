export type StopSort = 'nearest' | 'name' | 'live'

export const STOP_SORT_OPTIONS: { key: StopSort; label: string; short: string }[] = [
  { key: 'nearest', label: 'Nearest to me', short: 'Nearest' },
  { key: 'name', label: 'Name', short: 'Name' },
  { key: 'live', label: 'Live first', short: 'Live first' },
]
