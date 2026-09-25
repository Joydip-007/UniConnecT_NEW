/** A short id a user can read out to support and an admin can match in the console log. */
export function makeErrorId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(3))
  return `uc-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

export function formatErrorTime(at: Date): string {
  const date = at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
  return `${date}, ${time}`
}

export interface ErrorReport {
  id: string
  at: Date
  message: string
}

/** Plain-text block for "Copy details" and "Report a problem". */
export function errorReportText(report: ErrorReport): string {
  return [
    `Error ID: ${report.id}`,
    `Time: ${report.at.toISOString()}`,
    `Page: ${window.location.href}`,
    `Message: ${report.message}`,
    `Browser: ${navigator.userAgent}`,
  ].join('\n')
}

export async function copyErrorReport(report: ErrorReport): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(errorReportText(report))
    return true
  } catch {
    return false
  }
}
