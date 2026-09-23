/** `YYYY-MM-DD` read as a local calendar date — `new Date('2024-01-01')` is UTC midnight,
 *  which is still December west of Greenwich. */
export function parseCalendarDate(d: string | Date): Date {
  if (d instanceof Date) return d
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d)
}
